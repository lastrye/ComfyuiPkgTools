自定义comfyui manager开发

# Role
你是一位精通 Python、ComfyUI 架构及其扩展开发（Custom Nodes/Manager）的资深全栈工程师。

# Context
由于网络环境限制，ComfyUI Manager 默认的单线程下载机制在中国大陆地区经常失败或速度极慢。我需要对 ComfyUI Manager 进行定制化修改，引入 `aria2c` 多线程下载工具，并利用国内镜像源(https://hf-mirror.com)加速 HuggingFace 资源的下载。其次，更新ComfyUI Manager 插件UI，增加可以选择workflow保存目录下指定下载workflow涉及的模型功能

# Goal
在保持 ComfyUI Manager 原有架构完整性和修改成本最小化的前提下，实现基于 `aria2c` 的高速下载功能，并集成到 UI 中。

# Technical Requirements & Specifications

## 1. 核心下载逻辑 (Backend)
请编写一个 Python 模块或函数，替代原有的下载逻辑，具体要求如下：
- **工具调用**：使用 `subprocess` 调用系统安装的 `aria2c`。
- **参数配置**：强制使用多线程参数 `-x 16 -s 16`。
- **URL 处理**：在下载前检测 URL。如果是 `https://huggingface.co` 开头的链接，必须自动替换为 `https://hf-mirror.com`。
- **命令构造示例**：
  `aria2c -x 16 -s 16 [Mirror_URL] -d [Target_Directory] -o [Filename] `
- **异常处理**：确保如果 `aria2c` 未安装，能够报错提示或回退到普通下载（可选）。
- 可以显示下载进度，调用ComfyUI Manager进度显示功能。

## 2. Workflow 分析与路径映射
实现对 Workflow JSON 文件的解析功能：
- **输入**：用户指定的 `.json` 工作流文件。
- **解析逻辑**：遍历节点，识别模型加载节点（如 CheckpointLoader, VAELoader, LoRA 等）。
- **路径匹配**：结合 ComfyUI 的 `folder_paths` 机制，确定模型应存储的相对路径（例如 `./models/checkpoints/` 或 `./models/loras/`）。
- **元数据提取**：如果 Workflow 中包含模型的源 URL（或通过 ComfyUI Manager 的数据库查询到了 URL），则将其传递给上述下载逻辑。

## 3. UI 集成与交互 (Frontend & Integration)
需要在 ComfyUI Manager 的界面中进行以下改动：
- **功能点 A (覆盖原生)**：拦截“Install Missing Custom Nodes/Models”功能，当识别到模型下载请求时，路由到新的 `aria2c` 下载器。
- **功能点 B (新增模块)**：在 Manager 菜单中增加一个新按钮/标签页，名为 "Custom Workflow Downloader"（自定义工作流下载）。
  - 允许用户上传或选择一个 `.json` workflow 文件。
  - 后端分析该文件包含的模型列表、下载地址、目标路径。
  - 前端展示列表，提供“一键加速下载”按钮。

## 4. 约束条件 (Constraints)
- **最小修改原则**：尽量不要重写 ComfyUI Manager 的核心类，而是通过继承、装饰器或外挂脚本的方式注入功能。
- **兼容性**：确保代码在 Linux 环境（支持 nohup）下运行良好。
- **日志反馈**：下载过程需要生成日志文件，以便用户查看进度（因为是 nohup 后台运行）。

# Deliverables
1. **Python Code**：核心的 Aria2c 下载类/函数代码。
2. **Integration Plan**：说明需要修改 ComfyUI Manager 的哪些具体文件（如 `__init__.py`, `js/manager.js` 等）以及插入代码的位置。
3. **Usage Guide**：简述如何使用新功能的说明。 保存为guide.md