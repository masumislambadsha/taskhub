import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UIState {
  sidebarOpen: boolean;
  notificationPanelOpen: boolean;
}

const initialState: UIState = {
  sidebarOpen: false,
  notificationPanelOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleNotificationPanel(state) {
      state.notificationPanelOpen = !state.notificationPanelOpen;
    },
    closeNotificationPanel(state) {
      state.notificationPanelOpen = false;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleNotificationPanel,
  closeNotificationPanel,
} = uiSlice.actions;
export default uiSlice.reducer;
