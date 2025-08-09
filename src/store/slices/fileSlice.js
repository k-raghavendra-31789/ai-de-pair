import { createSlice } from '@reduxjs/toolkit';

// File Slice
const fileSlice = createSlice({
  name: 'files',
  initialState: {
    selectedFile: null,
    availableFiles: [],
  },
  reducers: {
    setSelectedFile: (state, action) => {
      state.selectedFile = action.payload;
    },
    setAvailableFiles: (state, action) => {
      state.availableFiles = action.payload;
    },
  },
});

export const { setSelectedFile, setAvailableFiles } = fileSlice.actions;
export default fileSlice.reducer;
