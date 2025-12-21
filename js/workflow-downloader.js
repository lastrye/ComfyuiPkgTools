
import { app } from "../../scripts/app.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";
import { api } from "../../scripts/api.js";
import { show_message, customAlert, infoToast } from "./common.js";

export class WorkflowDownloader {
    static instance = null;

    constructor(app, manager_dialog) {
        this.app = app;
        this.manager_dialog = manager_dialog;
        
        this.element = $el("div", {
            parent: document.body,
            className: "comfy-modal cn-manager",
            style: { display: 'none', flexDirection: 'column' }
        });
        
        this.initContent();
    }

    initContent() {
        this.element.innerHTML = `
            <div class="cn-manager-header">
                <label style="color:white; font-size: 20px; margin-left: 10px;">Custom Workflow Downloader</label>
            </div>
            <div class="cn-manager-grid" style="overflow: auto; padding: 20px; color: white;">
                <div style="margin-bottom: 20px;">
                    <div style="margin-bottom: 10px;">
                        <label>Select Workflow from Server:</label>
                        <select id="wd-workflow-select" class="cn-manager-select">
                            <option value="">-- Select a workflow --</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label>Or Upload Local File:</label>
                        <input type="file" id="wd-upload-json" accept=".json" style="color: white; margin-left: 10px;">
                    </div>
                    <button id="wd-analyze-btn" class="cn-manager-button">Analyze Workflow</button>
                </div>
                <div id="wd-result-list"></div>
            </div>
            <div class="cn-manager-footer">
                <button id="wd-close-btn" class="cn-manager-button">Close</button>
                <div class="cn-flex-auto"></div>
                <button id="wd-download-btn" class="cn-manager-button" disabled>One-click Accelerated Download</button>
            </div>
            <style>
                .cn-manager-button {
                    background-color: #333;
                    color: white;
                    border: 1px solid #555;
                    padding: 5px 10px;
                    cursor: pointer;
                }
                .cn-manager-button:hover {
                    background-color: #444;
                }
                .cn-manager-button:disabled {
                    background-color: #222;
                    color: #555;
                    cursor: not-allowed;
                }
                .cn-manager-select {
                    background-color: #333;
                    color: white;
                    border: 1px solid #555;
                    padding: 5px;
                    margin-left: 10px;
                }
                #wd-result-list table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-bottom: 20px;
                }
                #wd-result-list th, #wd-result-list td {
                    border: 1px solid #555;
                    padding: 8px;
                    text-align: left;
                }
                #wd-result-list th {
                    background-color: #333;
                }
                h3 { margin-top: 0; }
            </style>
        `;

        this.element.querySelector("#wd-close-btn").onclick = () => this.close();
        this.element.querySelector("#wd-analyze-btn").onclick = () => this.analyze();
        this.element.querySelector("#wd-download-btn").onclick = () => this.download();
    }

    async fetchWorkflowList() {
        try {
            const response = await api.fetchApi('/manager/workflow/list');
            if (response.status === 200) {
                const workflows = await response.json();
                const select = this.element.querySelector("#wd-workflow-select");
                select.innerHTML = '<option value="">-- Select a workflow --</option>';
                workflows.forEach(w => {
                    const option = document.createElement("option");
                    option.value = w;
                    option.textContent = w;
                    select.appendChild(option);
                });
            }
        } catch (err) {
            console.error("Failed to fetch workflow list", err);
        }
    }

    async analyze() {
        const fileInput = this.element.querySelector("#wd-upload-json");
        const select = this.element.querySelector("#wd-workflow-select");
        
        let payload = null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    this.performAnalysis(json);
                } catch (err) {
                    console.error(err);
                    customAlert("Invalid JSON file.");
                }
            };
            reader.readAsText(file);
            return;
        } else if (select.value) {
            payload = { filename: select.value };
            this.performAnalysis(payload);
        } else {
            customAlert("Please select a workflow from the list or upload a file.");
        }
    }

    async performAnalysis(payload) {
        try {
            const response = await api.fetchApi('/manager/workflow/analyze', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            if (response.status === 200) {
                const result = await response.json();
                // Handle both old format (array) and new format (object)
                if (Array.isArray(result)) {
                    this.models = result;
                    this.nodes = [];
                } else {
                    this.models = result.models || [];
                    this.nodes = result.nodes || [];
                }
                this.renderList();
            } else {
                customAlert("Failed to analyze workflow.");
            }
        } catch (err) {
            console.error(err);
            customAlert("Error during analysis.");
        }
    }

    renderList() {
        const container = this.element.querySelector("#wd-result-list");
        container.innerHTML = "";
        
        const hasModels = this.models && this.models.length > 0;
        const hasNodes = this.nodes && this.nodes.length > 0;

        if (!hasModels && !hasNodes) {
            container.innerHTML = "No missing models or nodes found.";
            this.element.querySelector("#wd-download-btn").disabled = true;
            return;
        }

        if (hasModels) {
            this.element.querySelector("#wd-download-btn").disabled = false;
            
            const modelHeader = document.createElement("h3");
            modelHeader.textContent = "Missing Models";
            container.appendChild(modelHeader);

            const table = document.createElement("table");
            table.innerHTML = `
                <tr>
                    <th>Model Name</th>
                    <th>Filename</th>
                    <th>Target Path</th>
                </tr>
            `;
            
            this.models.forEach(m => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${m.name}</td>
                    <td>${m.filename}</td>
                    <td>${m.target_dir}</td>
                `;
                table.appendChild(tr);
            });
            container.appendChild(table);
        } else {
            this.element.querySelector("#wd-download-btn").disabled = true;
        }

        if (hasNodes) {
            const nodeHeader = document.createElement("h3");
            nodeHeader.textContent = "Missing Custom Nodes";
            container.appendChild(nodeHeader);

            const table = document.createElement("table");
            table.innerHTML = `
                <tr>
                    <th>Node Class</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Reference</th>
                </tr>
            `;
            
            this.nodes.forEach(n => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${n.node_class}</td>
                    <td>${n.title || 'Unknown'}</td>
                    <td>${n.author || 'Unknown'}</td>
                    <td>${n.reference ? `<a href="${n.reference}" target="_blank" style="color: #aaa;">Link</a>` : ''}</td>
                `;
                table.appendChild(tr);
            });
            container.appendChild(table);
        }
    }

    async download() {
        if (!this.models || this.models.length === 0) return;

        const response = await api.fetchApi('/manager/workflow/download', {
            method: 'POST',
            body: JSON.stringify(this.models)
        });

        if (response.status === 200) {
            infoToast("Download tasks queued.");
            
            // Also attempt to update the workflow file with correct model paths
            const select = this.element.querySelector("#wd-workflow-select");
            const filename = select.value;
            
            if (filename) {
                try {
                    await api.fetchApi('/manager/workflow/update_paths', {
                         method: 'POST',
                         body: JSON.stringify({
                             filename: filename,
                             models: this.models
                         })
                    });
                } catch (e) {
                    console.error("Failed to update workflow paths", e);
                }
            }
            
            await api.fetchApi('/manager/queue/start');
            this.showProgress();
        } else {
            customAlert("Failed to queue downloads.");
        }
    }

    async showProgress() {
        const container = this.element.querySelector("#wd-result-list");
        container.innerHTML = `
            <h3>Downloading...</h3>
            <div style="background: #222; border-radius: 4px; padding: 2px; margin-bottom: 10px;">
                <div id="wd-progress-bar" style="width: 0%; height: 20px; background: #4caf50; border-radius: 2px; transition: width 0.5s;"></div>
            </div>
            <div id="wd-progress-text">Initializing...</div>
        `;
        this.element.querySelector("#wd-download-btn").disabled = true;
        this.element.querySelector("#wd-close-btn").disabled = true;

        const poll = async () => {
            try {
                const response = await api.fetchApi('/manager/queue/status');
                if (response.status === 200) {
                    const status = await response.json();
                    const total = status.total_count;
                    const done = status.done_count;
                    const inProgress = status.in_progress_count;
                    
                    let percent = 0;
                    if (total > 0) {
                        percent = Math.floor((done / total) * 100);
                    } else if (!status.is_processing) {
                        percent = 100;
                    }

                    const bar = this.element.querySelector("#wd-progress-bar");
                    const text = this.element.querySelector("#wd-progress-text");
                    
                    if (bar && text) {
                        bar.style.width = `${percent}%`;
                        text.textContent = `Progress: ${percent}% (${done}/${total})`;
                    }

                    if (!status.is_processing && done >= total && total > 0) {
                         // Completed
                         if (bar) bar.style.width = "100%";
                         if (text) text.textContent = "Download Complete! Please restart ComfyUI if needed.";
                         this.element.querySelector("#wd-close-btn").disabled = false;
                         return;
                    }
                }
            } catch (e) {
                console.error("Progress poll error", e);
            }
            
            if (this.element.style.display !== "none") {
                setTimeout(poll, 1000);
            }
        };
        
        poll();
    }

    show() {
        this.element.style.display = "flex";
        this.element.style.zIndex = 10001;
        this.fetchWorkflowList();
    }

    close() {
        this.element.style.display = "none";
    }
}
