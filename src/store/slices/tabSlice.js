import { createSlice } from '@reduxjs/toolkit';

const tabSlice = createSlice({
  name: 'tabs',
  initialState: {
    openTabs: [],
    activeTabId: null,
  },
  reducers: {
    addTab: (state, action) => {
      const newTab = action.payload;
      const existingTabIndex = state.openTabs.findIndex(tab => tab.id === newTab.id);
      
      if (existingTabIndex >= 0) {
        state.openTabs[existingTabIndex] = newTab;
      } else {
        state.openTabs.push(newTab);
      }
      state.activeTabId = newTab.id;
    },
    closeTab: (state, action) => {
      const tabIdToClose = action.payload;
      state.openTabs = state.openTabs.filter(tab => tab.id !== tabIdToClose);
      
      if (state.activeTabId === tabIdToClose) {
        state.activeTabId = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1].id : null;
      }
    },
    setActiveTab: (state, action) => {
      state.activeTabId = action.payload;
    },
    updateTabs: (state, action) => {
      state.openTabs = action.payload;
    },
  },
});

export const { addTab, closeTab, setActiveTab, updateTabs } = tabSlice.actions;
export default tabSlice.reducer;
