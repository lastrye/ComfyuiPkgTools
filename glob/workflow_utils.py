
import manager_core as core
import folder_paths
import os
import nodes

model_dir_name_map = {
    "checkpoints": "checkpoints",
    "checkpoint": "checkpoints",
    "unclip": "checkpoints",
    "text_encoders": "text_encoders",
    "clip": "text_encoders",
    "vae": "vae",
    "lora": "loras",
    "t2i-adapter": "controlnet",
    "t2i-style": "controlnet",
    "controlnet": "controlnet",
    "clip_vision": "clip_vision",
    "gligen": "gligen",
    "upscale": "upscale_models",
    "embedding": "embeddings",
    "embeddings": "embeddings",
    "unet": "diffusion_models",
    "diffusion_model": "diffusion_models",
}

def get_model_dir(data):
    if 'download_model_base' in folder_paths.folder_names_and_paths:
        models_base = folder_paths.folder_names_and_paths['download_model_base'][0][0]
    else:
        models_base = folder_paths.models_dir

    if data['save_path'] != 'default':
        # Simple path handling
        return os.path.join(models_base, data['save_path'])
    else:
        model_dir_name = model_dir_name_map.get(data['type'].lower())
        if model_dir_name is not None:
             paths = folder_paths.folder_names_and_paths.get(model_dir_name)
             if paths:
                 return paths[0][0]
        return os.path.join(models_base, "etc")

async def analyze_workflow(workflow_json):
    try:
        model_list = await core.get_data_by_mode('cache', 'model-list.json')
    except Exception:
        model_list = {'models': []}

    try:
        node_map = await core.get_data_by_mode('cache', 'extension-node-map.json')
        custom_node_list = await core.get_data_by_mode('cache', 'custom-node-list.json')
        alter_list = await core.get_data_by_mode('cache', 'alter-list.json')
    except Exception:
        node_map = {}
        custom_node_list = {'custom_nodes': []}
        alter_list = {'items': []}

    models_db = model_list.get('models', [])
    filename_map = {m['filename']: m for m in models_db}
    
    # Create map: node_class -> [url]
    # node_map structure: "url": [["Node1", "Node2"], ...]
    node_class_to_url = {}
    for url, data in node_map.items():
        for node_name in data[0]:
            if node_name not in node_class_to_url:
                node_class_to_url[node_name] = []
            node_class_to_url[node_name].append(url)

    # Create map: url -> custom_node_info
    url_to_info = {}
    for node_info in custom_node_list.get('custom_nodes', []):
        for file_url in node_info.get('files', []):
            url_to_info[file_url] = node_info
        if 'reference' in node_info:
            url_to_info[node_info['reference']] = node_info
            
    # Augment with alter-list info
    for alter_info in alter_list.get('items', []):
        url = alter_info.get('id')
        if url and url not in url_to_info:
            url_to_info[url] = alter_info

    missing_models = []
    missing_nodes = []
    seen_filenames = set()
    seen_nodetypes = set()
    
    workflow_nodes = workflow_json.get('nodes', [])
    for node in workflow_nodes:
        # Check for missing models
        widgets_values = node.get('widgets_values', [])
        if isinstance(widgets_values, list):
            for val in widgets_values:
                if not isinstance(val, str):
                    continue
                
                matched_model = None
                if val in filename_map:
                    matched_model = filename_map[val]
                else:
                    basename = os.path.basename(val)
                    if basename in filename_map:
                        matched_model = filename_map[basename]
                
                if matched_model and val not in seen_filenames:
                    target_dir = get_model_dir(matched_model)
                    
                    if target_dir:
                        target_path = os.path.join(target_dir, matched_model['filename'])
                        if not os.path.exists(target_path):
                            seen_filenames.add(val)
                            missing_models.append({
                                'name': matched_model['name'],
                                'filename': matched_model['filename'],
                                'url': matched_model['url'],
                                'target_dir': target_dir,
                                'type': matched_model['type'],
                                'save_path': matched_model['save_path'],
                                'description': matched_model.get('description', '')
                            })

        # Check for missing nodes
        node_type = node.get('type')
        if node_type and node_type not in nodes.NODE_CLASS_MAPPINGS and node_type not in seen_nodetypes:
            seen_nodetypes.add(node_type)
            
            possible_urls = node_class_to_url.get(node_type, [])
            if not possible_urls:
                 # If no mapping found, maybe it's in alter-list? 
                 # But alter-list is usually id->info, not class->id.
                 pass

            for url in possible_urls:
                info = url_to_info.get(url)
                if info:
                    missing_nodes.append({
                        'author': info.get('author', 'Unknown'),
                        'title': info.get('title', 'Unknown'),
                        'id': info.get('id', 'Unknown'),
                        'reference': info.get('reference', url),
                        'description': info.get('description', ''),
                        'node_class': node_type
                    })
                else:
                    missing_nodes.append({
                        'author': 'Unknown',
                        'title': 'Unknown',
                        'id': 'Unknown',
                        'reference': url,
                        'description': 'Unknown custom node',
                        'node_class': node_type
                    })

    return {
        'models': missing_models,
        'nodes': missing_nodes
    }

def update_workflow_model_paths(workflow_json, models_info):
    """
    Updates the workflow JSON with corrected model paths based on downloaded model info.
    models_info: list of model objects (from analyze_workflow result) that were downloaded.
    """
    if not models_info:
        return workflow_json, False

    updated = False
    
    # Create a lookup map from filename (basename) to relative path
    # ComfyUI usually expects: "subdir/filename" if it's in a subdirectory of the model type root
    # or just "filename" if it's in the root.
    # The 'save_path' in model_info usually denotes the subdirectory.
    
    model_path_map = {}
    for m in models_info:
        filename = m.get('filename')
        save_path = m.get('save_path', 'default')
        
        if save_path != 'default':
            # Construct relative path: subdir/filename
            # We assume save_path is relative to the model type root (e.g. "SDXL", "v1.5")
            # Note: windows separators might need handling if running on win, but here we use / for consistency in JSON
            new_path = f"{save_path}/{filename}"
        else:
            new_path = filename
            
        model_path_map[filename] = new_path

    workflow_nodes = workflow_json.get('nodes', [])
    for node in workflow_nodes:
        widgets_values = node.get('widgets_values', [])
        if isinstance(widgets_values, list):
            for i, val in enumerate(widgets_values):
                if not isinstance(val, str):
                    continue
                
                # Check if this value matches any of our downloaded models
                # The value in the workflow might be just filename, or some other path
                basename = os.path.basename(val)
                
                if basename in model_path_map:
                    new_val = model_path_map[basename]
                    if val != new_val:
                        widgets_values[i] = new_val
                        updated = True

    return workflow_json, updated
