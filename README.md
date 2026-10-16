# ImageIntegration XISF Packager

A PixInsight script that packages the output images from manual **ImageIntegration** or **Drizzle Integration** into one multi-image XISF file, providing a workflow similar to WBPP's consolidated MasterLight and rejection-map output.

## Features

- **Standard ImageIntegration:** saves `Integration`, `Rejection Low`, and `Rejection High` together in one XISF file.
- **Drizzle Integration:** saves the Drizzle integration image and `Drizzle Weights` together in one XISF file.
- **Separate workflow detection:** if both standard and Drizzle outputs are open, the script offers the matching set for the selected workflow. Check the suggested windows before saving, especially if different windows have identical IDs.
- **Non-destructive:** the source image windows are not modified.

## Install through PixInsight's update system

1. Open **Resources → Updates → Manage Repositories…**
2. Add this repository URL:

   ```text
   https://raw.githubusercontent.com/AidenOvO/PixInsight-ImageIntegration-XISF-Packager/main/updates/
   ```
3. Click **OK**, then open **Resources → Updates → Check for Updates…**
4. Select the package and apply the update. Restart PixInsight if prompted.
5. Launch the script from **Script → Utilities → ImageIntegration XISF Packager**.

This repository is currently unsigned. PixInsight may display a security warning or require its unsigned-update/script setting to permit installation. Only install scripts from a source you trust.

## Manual installation

Download [`PackImageIntegrationXISF.js`](PackImageIntegrationXISF.js). In PixInsight, open **Script → Feature Scripts… → Add**, select the folder containing the JavaScript file, and confirm. The script is registered under **Script → Utilities → ImageIntegration XISF Packager**.

## Use

1. Run ImageIntegration or Drizzle Integration and leave the relevant output windows open.
2. Launch **ImageIntegration XISF Packager**.
3. Select **Standard ImageIntegration** or **Drizzle Integration**.
4. Verify the suggested output windows, adjust them if needed, and choose the destination XISF filename.

## Current release

Version **1.0.0** — initial public repository package.

## 中文说明

本脚本为 PixInsight 手动执行的 ImageIntegration 和 Drizzle Integration 提供多图集中保存功能：标准叠加可将 Integration、Rejection Low、Rejection High 保存到同一个 XISF；Drizzle 模式可将 Drizzle Integration 和 Drizzle Weights 保存到同一个 XISF。它旨在提供类似 WBPP 集中管理 MasterLight 与拒绝图的便利。两种流程分别选择，保存前请核对自动预选的窗口。
