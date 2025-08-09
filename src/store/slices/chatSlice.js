import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    chatInput: '',
    chatMessages: [],
    selectedLLM: 'claude-sonnet-3.5',
    attachedDocuments: [],
  },
  reducers: {
    setChatInput: (state, action) => {
      state.chatInput = action.payload;
    },
    addChatMessage: (state, action) => {
      state.chatMessages.push(action.payload);
    },
    setSelectedLLM: (state, action) => {
      state.selectedLLM = action.payload;
    },
    addAttachment: (state, action) => {
      const attachment = action.payload;
      const exists = state.attachedDocuments.find(doc => doc.id === attachment.id);
      if (!exists) {
        state.attachedDocuments.push(attachment);
      }
    },
    removeAttachment: (state, action) => {
      state.attachedDocuments = state.attachedDocuments.filter(doc => doc.id !== action.payload);
    },
    clearChat: (state) => {
      state.chatMessages = [];
      state.attachedDocuments = [];
      state.chatInput = '';
    },
  },
});

export const { 
  setChatInput, 
  addChatMessage, 
  setSelectedLLM, 
  addAttachment, 
  removeAttachment, 
  clearChat 
} = chatSlice.actions;
export default chatSlice.reducer;
