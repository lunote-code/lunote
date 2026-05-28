import {
  ArrowDownAZ,
  ArrowUpAZ,
  BadgeCheck,
  BookOpen,
  Braces,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  FilePlus,
  FileText,
  Focus,
  Keyboard,
  Folder,
  FolderOpen,
  FolderTree,
  Languages,
  Lightbulb,
  Link2,
  List,
  ListTree,
  Network,
  OctagonAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  PenLine,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'

export type SemanticIconName =
  | 'app-mark'
  | 'workspace'
  | 'workspace-open'
  | 'workspace-tree'
  | 'note'
  | 'note-new'
  | 'graph'
  | 'backlinks'
  | 'assets'
  | 'search'
  | 'settings'
  | 'appearance'
  | 'export'
  | 'editor'
  | 'language'
  | 'shortcuts'
  | 'source'
  | 'preview'
  | 'focus'
  | 'sidebar-close'
  | 'sidebar-open'
  | 'outline'
  | 'list'
  | 'close'
  | 'refresh'
  | 'sort-az'
  | 'sort-za'
  | 'sort-time'
  | 'sort-created'
  | 'chevron-down'
  | 'chevron-right'
  | 'empty'
  | 'callout-note'
  | 'callout-tip'
  | 'callout-important'
  | 'callout-warning'
  | 'callout-caution'
  | 'callout-danger'
  | 'callout-info'

export const iconRegistry: Record<Exclude<SemanticIconName, 'app-mark'>, LucideIcon> = {
  workspace: Folder,
  'workspace-open': FolderOpen,
  'workspace-tree': FolderTree,
  note: FileText,
  'note-new': FilePlus,
  graph: Network,
  backlinks: Link2,
  assets: CircleDot,
  search: Search,
  settings: Settings,
  appearance: Palette,
  export: Download,
  editor: PenLine,
  language: Languages,
  shortcuts: Keyboard,
  source: Braces,
  preview: BookOpen,
  focus: Focus,
  'sidebar-close': PanelLeftClose,
  'sidebar-open': PanelLeftOpen,
  outline: ListTree,
  list: List,
  close: X,
  refresh: RefreshCw,
  'sort-az': ArrowDownAZ,
  'sort-za': ArrowUpAZ,
  'sort-time': Clock3,
  'sort-created': CalendarDays,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  empty: Sparkles,
  'callout-note': CircleDot,
  'callout-info': CircleDot,
  'callout-tip': Lightbulb,
  'callout-important': BadgeCheck,
  'callout-warning': TriangleAlert,
  'callout-caution': OctagonAlert,
  'callout-danger': ShieldAlert,
}
