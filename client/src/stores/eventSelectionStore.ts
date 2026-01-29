import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Event, EventCluster, EventSelection, EventContext, SortOption } from '../types';

interface EventSelectionState {
  // Current selection state
  selection: EventSelection | null;
  isOpen: boolean;

  // Cluster view state
  clusterSortOption: SortOption;
  expandedRegion: boolean;

  // Context enrichment
  context: EventContext | null;

  // History for navigation
  selectionHistory: EventSelection[];
  historyIndex: number;

  // Actions
  selectEvent: (event: Event, lat: number, lng: number) => void;
  selectCluster: (cluster: EventCluster) => void;
  setSelection: (selection: EventSelection | null) => void;
  clearSelection: () => void;

  // Cluster actions
  setClusterSort: (option: SortOption) => void;
  toggleExpandRegion: () => void;
  selectEventFromCluster: (event: Event) => void;

  // Context actions
  setContext: (context: EventContext) => void;
  clearContext: () => void;

  // Navigation
  goBack: () => boolean;
  goForward: () => boolean;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
}

export const useEventSelectionStore = create<EventSelectionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    selection: null,
    isOpen: false,
    clusterSortOption: 'recency',
    expandedRegion: false,
    context: null,
    selectionHistory: [],
    historyIndex: -1,

    // Select a single event
    selectEvent: (event: Event, lat: number, lng: number) => {
      const selection: EventSelection = {
        type: 'single',
        event,
        position: { lat, lng },
      };

      const { selectionHistory, historyIndex } = get();
      const newHistory = selectionHistory.slice(0, historyIndex + 1);
      newHistory.push(selection);

      set({
        selection,
        isOpen: true,
        context: null,
        selectionHistory: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    // Select a cluster of events
    selectCluster: (cluster: EventCluster) => {
      const selection: EventSelection = {
        type: 'cluster',
        cluster,
        position: { lat: cluster.centerLat, lng: cluster.centerLng },
      };

      const { selectionHistory, historyIndex } = get();
      const newHistory = selectionHistory.slice(0, historyIndex + 1);
      newHistory.push(selection);

      set({
        selection,
        isOpen: true,
        expandedRegion: false,
        context: null,
        selectionHistory: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    // Generic selection setter
    setSelection: (selection: EventSelection | null) => {
      if (selection) {
        const { selectionHistory, historyIndex } = get();
        const newHistory = selectionHistory.slice(0, historyIndex + 1);
        newHistory.push(selection);

        set({
          selection,
          isOpen: true,
          context: null,
          selectionHistory: newHistory,
          historyIndex: newHistory.length - 1,
        });
      } else {
        set({
          selection: null,
          isOpen: false,
          context: null,
        });
      }
    },

    // Clear current selection
    clearSelection: () => {
      set({
        selection: null,
        isOpen: false,
        context: null,
        expandedRegion: false,
      });
    },

    // Cluster view actions
    setClusterSort: (option: SortOption) => {
      set({ clusterSortOption: option });
    },

    toggleExpandRegion: () => {
      set((state) => ({ expandedRegion: !state.expandedRegion }));
    },

    // Select an individual event from a cluster view
    selectEventFromCluster: (event: Event) => {
      const selection: EventSelection = {
        type: 'single',
        event,
        position: { lat: event.lat, lng: event.lng },
      };

      const { selectionHistory, historyIndex } = get();
      const newHistory = selectionHistory.slice(0, historyIndex + 1);
      newHistory.push(selection);

      set({
        selection,
        context: null,
        selectionHistory: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    // Context enrichment
    setContext: (context: EventContext) => {
      set({ context });
    },

    clearContext: () => {
      set({ context: null });
    },

    // Navigation through history
    goBack: () => {
      const { historyIndex, selectionHistory } = get();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        set({
          selection: selectionHistory[newIndex],
          historyIndex: newIndex,
          context: null,
        });
        return true;
      }
      return false;
    },

    goForward: () => {
      const { historyIndex, selectionHistory } = get();
      if (historyIndex < selectionHistory.length - 1) {
        const newIndex = historyIndex + 1;
        set({
          selection: selectionHistory[newIndex],
          historyIndex: newIndex,
          context: null,
        });
        return true;
      }
      return false;
    },

    canGoBack: () => {
      return get().historyIndex > 0;
    },

    canGoForward: () => {
      const { historyIndex, selectionHistory } = get();
      return historyIndex < selectionHistory.length - 1;
    },
  }))
);

// Selectors for common derived state
export const selectCurrentEvent = (state: EventSelectionState): Event | undefined => {
  if (state.selection?.type === 'single') {
    return state.selection.event;
  }
  return undefined;
};

export const selectCurrentCluster = (state: EventSelectionState): EventCluster | undefined => {
  if (state.selection?.type === 'cluster') {
    return state.selection.cluster;
  }
  return undefined;
};

export const selectSortedClusterEvents = (state: EventSelectionState): Event[] => {
  const cluster = selectCurrentCluster(state);
  if (!cluster) return [];

  const events = [...cluster.events];

  switch (state.clusterSortOption) {
    case 'recency':
      return events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    case 'intensity':
      return events.sort((a, b) => b.intensity - a.intensity);
    case 'category':
      return events.sort((a, b) => a.category.localeCompare(b.category));
    default:
      return events;
  }
};
