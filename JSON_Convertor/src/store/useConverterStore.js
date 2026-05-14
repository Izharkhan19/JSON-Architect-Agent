import { create } from 'zustand';

const tryParseJson = (text) => {
  if (!text || !text.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e?.message || 'Invalid JSON' };
  }
};

const useConverterStore = create((set, get) => ({
  items: [{ id: Date.now(), type: 'text', content: '', name: 'Source 1', jsonError: null }], // Mixed list: { id, type, content, name, fileObj, jsonError }
  prompt: '',
  lastUsedPrompt: '', // Track the prompt that generated the current output
  outputJson: '{}',
  isGenerating: false,
  error: null,
  theme: localStorage.getItem('theme') || 'light',

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
  },

  addItem: (type = 'text', data = {}) => {
    const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem = {
      id: newId,
      type,
      content: data.content || '',
      name: data.name || (type === 'text' ? `Source ${get().items.filter(i => i.type === 'text').length + 1}` : 'New File'),
      fileObj: data.fileObj || null,
      jsonError: null
    };
    set({ items: [...get().items, newItem], error: null });
    return newId; // Return ID for UI to auto-expand
  },

  addFiles: async (files) => {
    let currentItems = get().items;

    // Check if the first object is blank text, if so, remove it
    if (currentItems.length === 1 && currentItems[0].type === 'text' && currentItems[0].content.trim() === '') {
      currentItems = [];
    }

    const newIds = [];
    const fileLoadPromises = Array.from(files).map((file, idx) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const id = `file-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`;
          newIds.push(id);

          // Calculate doc number based on existing file items
          const fileCount = currentItems.filter(i => i.type === 'file').length + idx + 1;

          resolve({
            id,
            type: 'file',
            content: e.target.result,
            name: file.name, // Use actual filename
            fileObj: file,
            jsonError: null
          });
        };
        reader.readAsText(file);
      });
    });

    const newItems = await Promise.all(fileLoadPromises);
    set({ items: [...currentItems, ...newItems], error: null });
    return newIds;
  },

  removeItem: (id) => {
    const newItems = get().items.filter(item => item.id !== id);
    if (newItems.length === 0) newItems.push({ id: Date.now(), type: 'text', content: '', name: 'Source 1', jsonError: null });
    set({ items: newItems, error: null });
  },

  updateItemContent: (id, content) => {
    const newItems = get().items.map(item => {
      if (item.id === id) {
        // Validation: Check if manual text exceeds 1MB
        if (item.type === 'text' && content.length > 1024 * 1024) {
          set({ error: "Object too large (>1MB). Please save it as a .txt file and upload it instead." });
        } else if (get().error?.includes("Object too large")) {
          set({ error: null });
        }

        // Per-item JSON validation (text + small files only)
        let jsonError = item.jsonError || null;
        if (item.type === 'text') {
          const parsed = tryParseJson(content);
          jsonError = parsed.ok ? null : parsed.error;
        } else if (item.type === 'file' && content.length <= 2 * 1024 * 1024) {
          const parsed = tryParseJson(content);
          jsonError = parsed.ok ? null : parsed.error;
        }

        return { ...item, content, jsonError };
      }
      return item;
    });
    set({ items: newItems });
  },

  setPrompt: (val) => set({ prompt: val, error: null }),

  generateJson: async () => {
    const { items, prompt } = get();

    const textInputs = items.filter(i => i.type === 'text' && i.content.trim() !== '').map(i => i.content.trim());
    const files = items.filter(i => i.type === 'file').map(i => i.fileObj);

    if (textInputs.length === 0 && files.length === 0) {
      set({ error: "Architecture Blocked: Please enter JSON data in 'Source' objects or attach .txt files before deploying." });
      return;
    }

    if (!prompt.trim()) {
      set({ error: "Instruction Missing: Please provide a prompt describing how to architect the data." });
      return;
    }

    const invalid = items.filter(i => i.jsonError);
    if (invalid.length > 0) {
      set({
        error: `Fix JSON syntax error in: ${invalid.map(i => i.name || 'Source').join(', ')}`
      });
      return;
    }

    set({ error: null, isGenerating: true });

    try {
      const baseUrl = import.meta.env.VITE_API_BASEURL || `http://localhost:5000/api`;
      const formData = new FormData();

      const jsonInputs = items.map(item => ({
        type: item.type,
        content: item.content,
        name: item.name || (item.type === 'file' ? item.fileObj?.name : `Source`)
      }));

      formData.append('jsonInputs', JSON.stringify(jsonInputs));
      formData.append('prompt', prompt);
      files.forEach(file => {
        formData.append('files', file);
      });

      // Properly log FormData for debugging
      // console.log('========== FORMDATA ENTRIES ==========');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value instanceof File ? `${value.name} (${value.size} bytes)` : value);
      }
      // console.log('=====================================');

      const response = await fetch(`${baseUrl}/convert`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to connect to AI engine');
      }

      const data = await response.json();
      set({
        outputJson: JSON.stringify(data, null, 2),
        lastUsedPrompt: prompt, // Save the prompt that was just used
        prompt: '', // Clear the prompt box
        isGenerating: false
      });
    } catch (err) {
      set({
        outputJson: JSON.stringify({ error: "Conversion Failed", details: err.message }, null, 2),
        isGenerating: false,
        error: `Error: ${err.message}`
      });
    }
  },

  clearAll: () => set({
    items: [{ id: Date.now(), type: 'text', content: '', name: 'Source 1', jsonError: null }],
    prompt: '',
    lastUsedPrompt: '',
    outputJson: '{}',
    error: null
  })
}));

export default useConverterStore;
