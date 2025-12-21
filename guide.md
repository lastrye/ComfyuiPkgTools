# Custom Workflow Downloader & Aria2c Integration Guide

## Overview

This update introduces a robust download acceleration mechanism using `aria2c` and a new "Custom Workflow Downloader" feature to simplify model management.

## Features

### 1. Aria2c Acceleration (Core Backend)
- **Multi-threaded Downloading**: Automatically uses `aria2c` with `-x 16 -s 16` for parallel connections, significantly improving download speeds.
- **Mirror Support**: Automatically replaces `https://huggingface.co` URLs with `https://hf-mirror.com` for faster access in restricted regions.
- **Fallback Mechanism**: If `aria2c` is not installed, the system gracefully falls back to the default download method.
- **Integration**: Works seamlessly with existing "Install Missing Custom Nodes" and "Install Models" features.

### 2. Custom Workflow Downloader (UI)
A new tool to analyze workflow files and batch download required models.

- **Analyze**: Upload a `.json` workflow file to identify all used models.
- **Check**: Automatically checks which models are missing from your installation.
- **Download**: One-click button to download all missing models using the accelerated `aria2c` backend.

## Prerequisites

- **Aria2c**: Ensure `aria2c` is installed on your system and available in the system PATH.
  - **Linux**: `sudo apt install aria2`
  - **Windows**: Download from [aria2.github.io](https://aria2.github.io/) and add the binary folder to your Path environment variable.

## Usage

### Using Custom Workflow Downloader

1. Open **ComfyUI Manager**.
2. Click the new **Custom Workflow Downloader** button in the menu.
3. Click **Choose File** and select your `.json` workflow file.
4. Click **Analyze Workflow**.
5. Review the list of missing models.
6. Click **One-click Accelerated Download** to start downloading.

### Verifying Installation

- **Logs**: Check the `logs/` directory in ComfyUI Manager for `aria2_[filename].log` files to monitor download progress and details.
- **Console**: Download progress is also printed to the console (stderr).

## Troubleshooting

- **"aria2c is not installed"**: Verify that you can run `aria2c --version` in your terminal.
- **Download Fails**: Check the generated log files for specific error messages. Ensure you have write permissions to the `models` directory.


<!-- 重启之后的comfyui manager 可以看到新的按钮，但是需要自己从本地文件上传workflow文件，并没有自动识别保存在后端的workflow文件。请实现本地上传和自动识别user/default/workflows文件夹下的json（自动识别后下拉菜单显示）。

选择指定的workflow 之后分析结果并没有显示缺失信息，可能并没有与custom_nodes/comfyui-manager下custom_nodes/comfyui-manager/custom-node-list.json，custom_nodes/comfyui-manager/model-list.json，custom_nodes/comfyui-manager/alter-list.json 中的数据库信息进行匹配。进而导致下载缺失模型失败。 请根据这些模型数据库进行匹配并获取下载URL地址，模型类型以及在models文件夹下的存储路径。 -->