import sys
import torch
import torch.nn as nn
from types import ModuleType
import logging
import os
import time
from io import BytesIO
import base64
import numpy as np
import cv2
from PIL import Image
from contextlib import contextmanager
from typing import Dict, Optional 

# ======================== 定义全局设备变量 ========================
try:
    if torch.cuda.is_available():
        device = "cuda:0"
        torch.backends.cudnn.benchmark = True
        print(f"🚀 [全局初始化] 发现 GPU: {torch.cuda.get_device_name(0)} (PyTorch {torch.__version__})")
    else:
        device = "cpu"
        print(f"⚠️ [全局初始化] 未检测到 GPU，使用 CPU (PyTorch {torch.__version__})")
except Exception as e:
    print(f"⚠️ [全局初始化] 设备检测出错: {e}")
    device = "cpu"
try:
    from ultralytics import YOLO
    import ultralytics.nn.modules 
except ImportError as e:
    print(f"❌ 严重错误: 无法导入 ultralytics 库。请确保已安装: pip install ultralytics")
    raise e

# Pydantic 模型（用于解析请求体）
from pydantic import BaseModel 

# 手动实现 ECA 模块（适配自定义模型）
class ECA(nn.Module):
    """ECA (Efficient Channel Attention) module from https://arxiv.org/abs/1910.03151."""
    def __init__(self, c1, k=3):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.conv = nn.Conv1d(1, 1, kernel_size=k, padding=(k - 1) // 2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        y = self.avg_pool(x).view(x.size(0), 1, x.size(1))  # (bs, 1, c)
        y = self.conv(y).view(x.size(0), x.size(1), 1, 1)  # (bs, c, 1, 1)
        return x * self.sigmoid(y)

# 安全注入 ECA 模块（避免模型加载报错）
eca_module_name = "ultralytics.nn.modules.eca"
if eca_module_name not in sys.modules:
    eca_mod = ModuleType(eca_module_name)
    eca_mod.ECA = ECA
    sys.modules[eca_module_name] = eca_mod
    setattr(ultralytics.nn.modules, 'eca', eca_mod)
    print(f"✅ 已成功注入 {eca_module_name} 模块以支持自定义模型加载")

# 其他 Web 框架依赖导入
from fastapi import FastAPI, UploadFile, File, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from logging.handlers import RotatingFileHandler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ======================== 日志配置 ========================
os.makedirs("logs", exist_ok=True)
logger = logging.getLogger("helmet_rider_detect")
logger.setLevel(logging.INFO)
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

file_handler = RotatingFileHandler(
    "logs/detect.log", maxBytes=5*1024*1024, backupCount=3, encoding="utf-8"
)
file_handler.setFormatter(formatter)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

# ======================== 应用初始化 ========================
app = FastAPI(title="头盔检测接口API", version="1.0")

# 允许前端预检请求（解决 OPTIONS 405 / CORS 问题）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================== 限流配置 ========================
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ======================== 模型加载 ========================
model_path ={"YOLOv8s (Small) -无eca注意力1s版本":os.path.join("model", "helmet_detect_noEca.pt")
             ,"YOLOv8s (Small) -Eca注意力2s版本":os.path.join("model", "helmet_detect_Eca.pt")
            }
loaded_models:Dict[str,YOLO]={}
@contextmanager
def patch_torch_load():
    original_load = torch.load
    def custom_load(*args, **kwargs):
        kwargs['weights_only'] = False  # 兼容旧版本 PyTorch 模型
        return original_load(*args, **kwargs)
    torch.load = custom_load
    try:
        yield
    finally:
        torch.load = original_load

# 加载模型（带异常处理）

def load_all_models():
    """启动时一次性把所有模型都加载到内存里"""
    global loaded_models
    for key, path in model_path.items():
        try:
            if os.path.exists(path):
                logger.info(f"正在加载模型 [{key}]: {path} ...")
                with patch_torch_load():
                    model = YOLO(path, task='detect')
                    model.to(device)
                    # 预热一下
                    dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
                    model(dummy_img, conf=0.5, augment=False, verbose=False, half=(device != 'cpu'))
                    loaded_models[key] = model # 存入字典
                logger.info(f"✅ 模型 [{key}] 加载成功！")
            else:
                logger.warning(f"⚠️ 未找到模型文件: {path}，[{key}] 模式将不可用。")
        except Exception as e:
            logger.error(f"❌ 模型 [{key}] 加载失败：{str(e)}", exc_info=True)

# 执行加载
load_all_models()

def get_model_by_version(version_str: str) -> Optional[YOLO]:
    #核心逻辑：根据前端传来的中文名称，决定用哪个模型
    if "无eca" in version_str or "no-eca" in version_str.lower():
        return loaded_models.get("YOLOv8s (Small) -无eca注意力1s版本")
    else:
        return loaded_models.get("YOLOv8s (Small) -Eca注意力2s版本")

# ======================== 请求体模型定义（适配前端） ========================
class VideoFrameReq(BaseModel):
    base64: str  # 前端传递的 Base64 编码视频帧（不含前缀）

# ======================== 辅助函数 ========================
def base64_to_image(base64_str: str) -> Optional[np.ndarray]:
    """将 Base64 字符串转换为 numpy 图像数组"""
    try:
        # 移除可能存在的前缀（如 data:image/jpeg;base64,）
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        # 解码 Base64 为字节流
        img_data = base64.b64decode(base64_str)
        # 转换为 PIL 图像并转为 RGB 格式
        img = Image.open(BytesIO(img_data)).convert("RGB")
        return np.array(img)
    except Exception as e:
        logger.error(f"❌ Base64 转图像失败：{str(e)}", exc_info=True)
        return None

def process_results(results, img_shape: tuple) -> list:
    """解析模型推理结果，转换为前端需要的格式"""
    boxes = []
    img_h, img_w = img_shape
    
    for i, r in enumerate(results):
        # 校验 boxes 是否存在
        if not hasattr(r, 'boxes') or r.boxes is None:
            continue
        for j, box in enumerate(r.boxes):
            # 校验 xyxy 是否有效
            if box.xyxy is None or len(box.xyxy) == 0:
                continue
            if box.id is not None:
                track_id = int(box.id.item())
            else:
                track_id = int(time.time()) + i * 100 + j
            # 解析检测框坐标（像素值）
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            # 转换为百分比坐标（适配前端不同尺寸展示）
            x = (x1 / img_w) * 100
            y = (y1 / img_h) * 100
            width = ((x2 - x1) / img_w) * 100
            height = ((y2 - y1) / img_h) * 100
            
            # 解析置信度和类别
            conf = round(float(box.conf[0]), 2)
            cls = int(box.cls[0])
            
            # 类别映射（按模型训练时的类别顺序：0=骑行者，1=戴头盔，2=未戴头盔）
            if cls == 0:
                label = "骑行者"
                target_type = "rider"
                is_helmet = None  # 仅骑行者，无头盔状态
            elif cls == 1:
                label = "佩戴头盔"
                target_type = "helmet"
                is_helmet = True
            elif cls == 2:
                label = "未戴头盔"
                target_type = "no_helmet"
                is_helmet = False
            else:
                label = "未知目标"
                target_type = "unknown"
                is_helmet = None
            
            # 组装检测框数据（前端可直接使用）
            boxes.append({
                "x": round(x, 2),
                "y": round(y, 2),
                "width": round(width, 2),
                "height": round(height, 2),
                "conf": str(conf),  # 前端需要字符串格式的置信度
                "label": label,
                "type": target_type,
                "isHelmet": is_helmet,
                "track_id": track_id,
                "id": f"box_{int(time.time() * 1000)}_{len(boxes)}"  # 唯一ID
            })
    return boxes

def draw_boxes(img_np: np.ndarray, boxes: list) -> str:
    """在图像上绘制检测框（用 OpenCV 实现，兼容所有版本）"""
    # 复制原图像，避免修改原图
    img_with_boxes = img_np.copy()
    img_h, img_w = img_np.shape[:2]
    
    # 颜色映射（BGR 格式，OpenCV 绘图默认用 BGR）
    color_map = {
        "rider": (255, 144, 24),    # 蓝色：骑行者（BGR）
        "helmet": (26, 196, 82),    # 绿色：佩戴头盔（BGR）
        "no_helmet": (79, 77, 255), # 红色：未戴头盔（BGR）
        "unknown": (20, 173, 250)   # 黄色：未知目标（BGR）
    }
    
    for box in boxes:
        # 1. 百分比坐标转回像素坐标（并转为整数）
        x1 = int((box["x"] / 100) * img_w)
        y1 = int((box["y"] / 100) * img_h)
        x2 = int(x1 + (box["width"] / 100) * img_w)
        y2 = int(y1 + (box["height"] / 100) * img_h)
        
        # 2. 确保坐标不超出图像范围
        x1 = max(0, min(x1, img_w - 1))
        y1 = max(0, min(y1, img_h - 1))
        x2 = max(0, min(x2, img_w - 1))
        y2 = max(0, min(y2, img_h - 1))
        
        # 3. 获取检测框颜色
        color = color_map.get(box["type"], color_map["unknown"])
        
        # 4. 绘制检测框（线宽 2）
        cv2.rectangle(img_with_boxes, (x1, y1), (x2, y2), color, 2)
        
        # 5. 绘制标签（类别 + 置信度）
        label_text = f"{box['label']} {box['conf']}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.4
        font_thickness = 1
        # 计算标签文本尺寸
        text_width, text_height = cv2.getTextSize(label_text, font, font_scale, font_thickness)[0]
        
        # 6. 调整标签位置（避免超出图像）
        label_x = x1
        label_y = y1 - 5
        if label_y < text_height:
            label_y = y1 + text_height + 5
        
        # 7. 绘制标签背景（半透明）
        label_bg_x1 = label_x
        label_bg_y1 = label_y - text_height - 2
        label_bg_x2 = label_x + text_width
        label_bg_y2 = label_y + 2
        overlay = img_with_boxes.copy()
        cv2.rectangle(overlay, (label_bg_x1, label_bg_y1), (label_bg_x2, label_bg_y2), color, -1)
        alpha = 0.7  # 透明度
        cv2.addWeighted(overlay, alpha, img_with_boxes, 1 - alpha, 0, img_with_boxes)
        
        # 8. 绘制标签文本（白色）
        cv2.putText(
            img_with_boxes,
            label_text,
            (label_x, label_y),
            font,
            font_scale,
            (255, 255, 255),
            font_thickness,
            cv2.LINE_AA
        )
    
    # 9. 转为 Base64 编码返回
    success, buffer = cv2.imencode(".jpg", img_with_boxes, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not success:
        logger.error("❌ 图像编码失败，无法生成带检测框的图片")
        return ""
    return base64.b64encode(buffer).decode("utf-8")

# ======================== 全局异常处理 ========================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "服务器内部错误，请稍后再试"}
    )

# ======================== 接口定义（和前端完全适配） ========================
@app.get("/", include_in_schema=False)
async def root():
    """根路径重定向到 Swagger 文档"""
    return RedirectResponse(url="/docs")

@app.post("/detect/video-frame", summary="视频帧检测", description="接收 Base64 编码的视频帧，返回头盔检测结果")
@limiter.limit("60/second")  # 限流：每秒最多 60 次请求
async def detect_video_frame(
    request: Request,
    item: VideoFrameReq,  # 接收 JSON 格式的请求体
    conf_threshold: float = Query(default=0.5, ge=0.1, le=1.0, description="置信度阈值"),
    iou_threshold: float = Query(default=0.45, ge=0.1, le=1.0, description="IOU 阈值"),
    model_version: str = Query(default="default")
):
    current_model = get_model_by_version(model_version)
    # 检查模型是否加载成功
    global device
    if current_model is None:
        logger.error("❌ 视频帧检测失败：模型未加载")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "模型未加载或加载失败，请检查模型文件"}
        )

    start_time = time.time()
    try:
        # Base64 转图像
        img = base64_to_image(item.base64)
        if img is None:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Base64 编码解码失败，请检查视频帧格式"}
            )
        
        # 模型推理（指定设备和参数）
        results = current_model.track(
            img, 
            persist=True,
            tracker="bytetrack.yaml",  # 使用 ByteTrack 跟踪器  
            conf=conf_threshold, 
            iou=iou_threshold, 
            verbose=False,
        )
        
        # 解析结果
        boxes = process_results(results, img.shape[:2])
        latency = round((time.time() - start_time) * 1000, 2)
        
        # 返回结果（和前端预期格式一致）
        return JSONResponse(
            content={
                "status": "success",
                "message": "检测成功",
                "data": {
                    "boxes": boxes,
                    "latency": latency  # 推理延迟（ms）
                }
            }
        )
    except Exception as e:
        logger.error(f"❌ 视频帧检测异常：{str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"检测失败：{str(e)}"}
        )

@app.post("/detect/image", summary="图片检测", description="上传图片文件，返回头盔检测结果和可视化图像")
@limiter.limit("30/minute")  # 限流：每分钟最多 30 次请求
async def detect_image(
    request: Request,
    file: UploadFile = File(..., description="待检测的图片文件（支持 JPG、PNG、JPEG 格式）"),
    conf_threshold: float = Query(default=0.5, ge=0.1, le=1.0, description="置信度阈值"),
    iou_threshold: float = Query(default=0.45, ge=0.1, le=1.0, description="IOU 阈值"),
    need_visualize: bool = Query(default=True, description="是否需要返回带检测框的可视化图像"),
    model_version: str = Query(default="default")
):
    current_model = get_model_by_version(model_version)
    # 检查模型是否加载成功
    global device
    if current_model is None:
        logger.error("❌ 图片检测失败：模型未加载")
        return JSONResponse(
            status_code=503,
            content={"status": "error", "message": "模型未加载或加载失败，请检查模型文件"}
        )

    start_time = time.time()
    try:
        # 读取上传的图片文件并校验
        content = await file.read()
        try:
            img = Image.open(BytesIO(content)).convert("RGB")
            img_np = np.array(img)
            # 校验图片有效性
            if img_np is None or img_np.shape[:2] == (0, 0):
                return JSONResponse(
                    status_code=400,
                    content={"status": "error", "message": "图片无效或损坏，请上传清晰的 JPG/PNG 图片"}
                )
        except Exception as e:
            logger.error(f"❌ 图片解码失败：{str(e)}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": f"图片解码失败：{str(e)}"}
            )
        
        # 模型推理
        results = current_model(
            img_np,
            conf=conf_threshold,
            iou=iou_threshold,
            device=device,
            verbose=False,
            half=(device != 'cpu')
        )
        
        # 解析检测结果
        boxes = process_results(results, img_np.shape[:2])
        
        # 生成可视化图像（Base64 编码）
        viz_base64 = ""
        if need_visualize:
            viz_base64 = draw_boxes(img_np, boxes)
            
        # 计算推理延迟
        latency = round((time.time() - start_time) * 1000, 2)
        
        # 返回结果（包含图片宽高，适配前端绘制）
        return JSONResponse(
            content={
                "status": "success",
                "data": {
                    "boxes": boxes,
                    "img_width": img.width,
                    "img_height": img.height,
                    "latency": latency,
                    "img_with_boxes": viz_base64  # 带检测框的可视化图像
                }
            }
        )
    except Exception as e:
        logger.error(f"❌ 图片检测异常：{str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"检测失败：{str(e)}"}
        )

@app.get("/health", summary="健康检查", description="检查服务和模型状态")
def health_check():
    """健康检查接口（用于监控服务可用性）"""
    global device
    models_loaded = len(loaded_models) > 0
    return JSONResponse(
        content={
            "status": "healthy",
            "model_ready": models_loaded,
            "device": device,
            "model_path": model_path,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        }
    )

# 添加 SlowAPI 中间件
app.add_middleware(SlowAPIMiddleware)

if __name__ == "__main__":
    import uvicorn
    # 启动服务（默认端口 8000，支持热重载）
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )