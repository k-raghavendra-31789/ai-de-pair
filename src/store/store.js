import { configureStore } from '@reduxjs/toolkit';
import fileReducer from './slices/fileSlice';
import tabReducer from './slices/tabSlice';
import chatReducer from './slices/chatSlice';

export const store = configureStore({
  reducer: {
    files: fileReducer,
    tabs: tabReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for Map objects in Excel cache
        ignoredActions: ['excel/updateExcelCache'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['excel.excelCache'],
      },
    }),
});
