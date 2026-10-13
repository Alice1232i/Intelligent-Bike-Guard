# Intelligent-Bike-Guard

> YOLOv8s + ECA 非机动车头盔违规检测，端云协同 AI 监管系统

基于 YOLOv8s 目标检测模型（引入 ECA 通道注意力模块）的骑行头盔佩戴检测系统。前端负责视频/图像采集与结果可视化，后端提供推理接口，支持实时视频帧检测与图片检测。

## 功能特性

- **实时视频帧检测**：前端从摄像头抽取视频帧，经压缩后以 Base64 提交后端推理，支持多目标跟踪（ByteTrack）。
- **图片检测**：上传图片返回检测框数据及带框可视化图片（Base64）。
- **目标识别**：区分「骑行者 / 佩戴头盔 / 未戴头盔」三类目标。
- **抓拍与画廊**：支持抓拍快照、大图预览、下载、按类型筛选的画廊查看。
- **可视化统计**：折线图 / 环形图展示检测统计。
- **RFID 身份模拟**：演示用 RFID 数据池，将检测目标与骑手身份关联（可在设置中开关）。
- **参数化配置**：设置面板支持通用、模型、RFID、网络等配置项。
- **运行日志**：检测日志记录、清空与导出。
- **双模型切换**：可在「无 ECA」基线模型与「含 ECA」改进模型之间切换。

## 技术栈

**后端**
- FastAPI + Uvicorn
- Ultralytics YOLOv8（`YOLO`）、PyTorch
- OpenCV / Pillow / NumPy
- slowapi（限流）、python-multipart（文件上传）

**前端**
- React 19 + Vite（rolldown-vite）
- Tailwind CSS
- axios（HTTP 请求）、lucide-react（图标）

## 目录结构

```
Intelligent-Bike-Guard/
├── backend/
│   ├── main.py                # FastAPI 推理服务（模型加载 + 接口定义）
│   ├── requirements.txt       # 后端依赖
│   └── model/
│       ├── helmet_detect_Eca.pt      # YOLOv8s + ECA 注意力模型
│       ├── helmet_detect_noEca.pt    # YOLOv8s 基线模型
│       └── test.py                   # 模型加载自检脚本
├── frontend/
│   ├── src/
│   │   ├── APP.jsx            # 主应用（检测 / 抓拍 / 设置 / 登录等组件）
│   │   ├── main.jsx           # 入口
│   │   └── index.css          # Tailwind 入口
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.cjs
├── .vscode/
└── README.md
```

## 快速开始

### 1. 后端

```bash
cd backend
pip install -r requirements.txt

# 确认模型文件已就位于 backend/model/
# 启动服务（默认 http://0.0.0.0:8000）
python main.py
```

启动后：
- 接口文档（Swagger）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

> 服务启动时会一次性加载 `backend/model/` 下的全部模型并做预热。若检测到 GPU 则使用 `cuda:0`，否则回退 CPU。

### 2. 前端

```bash
cd frontend
npm install
npm run dev        # 默认 http://localhost:5173
```

其他脚本：`npm run build`（构建）、`npm run preview`（预览构建产物）、`npm run lint`（ESLint）。

> 前端默认请求后端 `http://localhost:8000`，请先启动后端再使用检测功能。

## 接口说明

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/` | 重定向到 `/docs` |
| `POST` | `/detect/video-frame` | 视频帧检测（请求体为 Base64 帧） |
| `POST` | `/detect/image` | 图片检测（multipart 文件上传） |
| `GET` | `/health` | 服务与模型状态检查 |

**`POST /detect/video-frame`**

- 请求体：`{ "base64": "<不含前缀的 Base64 图像>" }`
- 查询参数：`conf_threshold`(默认 0.5)、`iou_threshold`(默认 0.45)、`model_version`
- 返回：`{ status, message, data: { boxes, latency } }`

**`POST /detect/image`**

- 表单：`file`（JPG/PNG/JPEG）
- 查询参数：`conf_threshold`、`iou_threshold`、`need_visualize`(默认 true)、`model_version`
- 返回：`{ status, data: { boxes, img_width, img_height, latency, img_with_boxes } }`

**类别映射**：`0 = 骑行者`，`1 = 佩戴头盔`，`2 = 未戴头盔`。

**接口限流**：全局 120/分钟；视频帧接口 60/秒；图片接口 30/分钟。

## 模型说明

- `helmet_detect_Eca.pt`：YOLOv8s + ECA 通道注意力改进模型（默认使用）。
- `helmet_detect_noEca.pt`：YOLOv8s 基线模型，用于对比。

请求时通过 `model_version` 参数切换；含「无 eca / no-eca」关键字时使用基线模型，否则使用 ECA 模型。

> ECA 为自定义模块，需在加载 YOLO 模型前注入到 `ultralytics.nn.modules.eca`，后端代码已自动处理，无需额外配置。

## 配置说明

- **登录凭证**：前端登录账号为占位常量，位于 `frontend/src/APP.jsx`：

  ```js
  const AUTH_USERNAME = 'your-username-here';
  const AUTH_PASSWORD = 'your-password-here';
  ```

  部署前请替换为实际值（或改为调用后端鉴权接口）。

- **后端地址**：前端请求地址当前为 `http://localhost:8000`，如需变更请修改 `frontend/src/APP.jsx` 中的请求 URL。

## 注意事项

- 本仓库未包含 `frontend/node_modules`，首次使用前端请先执行 `npm install`。
- 后端依赖 `backend/model/` 下的 `.pt` 模型文件，缺失时对应模型将不可用（服务仍可启动）。
- 服务运行时会在 `backend/` 下自动创建 `logs/` 目录用于记录检测日志。
- 后端 CORS 当前为全开放（`allow_origins=["*"]`），仅便于本地开发调试，生产环境请按需收紧。