import sys
import os
import torch
import torch.nn as nn
from types import ModuleType
import numpy as np

# ======================== 第一步：先导入 ultralytics（解决 NameError: name 'ultralytics' is not defined）========================
try:
    from ultralytics import YOLO
    import ultralytics.nn.modules  # 提前导入 ultralytics 模块，后续注入时使用
except ImportError as e:
    print(f"❌ 无法导入 ultralytics 库：{e}")
    print("请先安装：pip install ultralytics --upgrade")
    sys.exit(1)  # 导入失败直接退出，避免后续报错

# ======================== 第二步：手动实现 ECA 模块 + 注入（解决 No module named 'ultralytics.nn.modules.eca'）========================
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

# 安全注入 ECA 模块到 ultralytics
eca_module_name = "ultralytics.nn.modules.eca"
if eca_module_name not in sys.modules:
    eca_mod = ModuleType(eca_module_name)
    eca_mod.ECA = ECA
    sys.modules[eca_module_name] = eca_mod
    setattr(ultralytics.nn.modules, 'eca', eca_mod)
    print(f"✅ 已成功注入 {eca_module_name} 模块")

# ======================== 第三步：设备检测（兼容 GPU/CPU，解决 CUDA 兼容问题）========================
print("=" * 50)
print(f"PyTorch 版本: {torch.__version__}")
try:
    if torch.cuda.is_available():
        device = "cuda:0"
        torch.backends.cudnn.benchmark = True
        print(f"🚀 检测到 GPU: {torch.cuda.get_device_name(0)}")
        print(f"   CUDA 计算能力: {torch.cuda.get_device_capability(0)}")
        print(f"   PyTorch CUDA 版本: {torch.version.cuda}")
    else:
        device = "cpu"
        print(f"⚠️ 未检测到 GPU，使用 CPU 运行")
except Exception as e:
    print(f"⚠️ 设备检测出错: {e}，强制使用 CPU")
    device = "cpu"
print(f"最终使用设备: {device}")
print("=" * 50)

# ======================== 第四步：模型加载 + 验证 ========================
# 模型路径（相对本脚本所在目录）
model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "helmet_detect_Eca.pt")

try:
    # 检查模型文件是否存在
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型文件不存在: {model_path}")
    
    print(f"\n正在加载模型: {model_path}")
    # 加载模型（指定任务为检测）
    current_model = YOLO(model_path, task='detect')
    # 移到目标设备（CPU/GPU）
    current_model.to(device)
    print(f"✅ 模型成功加载并移到 {device}")

    # 模型预热推理（验证设备可用性）
    dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)  # 模拟 640x640 的输入图像
    # 智能判断是否使用半精度（避免 GPU 不支持半精度导致的 CUDA 错误）
    use_half = device != 'cpu' and torch.cuda.get_device_capability()[0] >= 7
    results = current_model(dummy_img, conf=0.5, verbose=False, half=use_half)
    print("✅ 模型预热推理成功！")
    print(f"   推理结果类型: {type(results)}")
    print(f"   检测到的目标数: {len(results[0].boxes) if results and hasattr(results[0], 'boxes') else 0}")

    print("\n" + "=" * 50)
    print("🎉 测试完成！所有问题已解决，模型可正常运行")
    print("=" * 50)

except Exception as e:
    print(f"\n❌ 测试失败: {str(e)}")
    print("\n建议解决方案：")
    # 针对 CUDA 内核错误的专项提示
    if "no kernel image" in str(e):
        print("1. 你的 GPU 架构（sm_120）不被当前 PyTorch 支持，请安装 CUDA 12.8 版本的 PyTorch：")
        print("   pip uninstall torch torchvision torchaudio -y")
        print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128")
    # 针对文件不存在的提示
    elif "not found" in str(e).lower():
        print(f"2. 请检查模型路径是否正确：{model_path}")
        print("   建议确认模型文件已放置在脚本同目录下")
    # 其他错误提示
    else:
        print("2. 若仍报错，可强制使用 CPU 运行（已在代码中默认处理）")
        print("3. 检查 ultralytics 版本：pip install ultralytics --upgrade")