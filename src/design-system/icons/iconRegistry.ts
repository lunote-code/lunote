import {
  AppWindow,
  ArrowDownAZ,
  ArrowUpAZ,
  Baseline,
  BadgeCheck,
  Bold,
  BookOpen,
  Braces,
  Calculator,
  CalendarDays,
  Camera,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardPaste,
  Clock3,
  Code,
  Copy,
  CornerDownLeft,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FilePlus,
  FileText,
  Focus,
  Folder,
  FolderOpen,
  FolderTree,
  Heading,
  Highlighter,
  History,
  Image,
  Info,
  Italic,
  Keyboard,
  Languages,
  LayoutTemplate,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  ListTree,
  LocateFixed,
  Maximize,
  MessageSquare,
  Minimize2,
  Minus,
  Network,
  OctagonAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Paperclip,
  PenLine,
  Printer,
  Quote,
  Redo2,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Smile,
  StickyNote,
  Sparkles,
  SquarePlus,
  Strikethrough,
  Superscript,
  Table,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  Underline,
  Upload,
  WholeWord,
  X,
  ZoomIn,
  ZoomOut,
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
  | 'tags'
  | 'frontmatter'
  | 'embeds'
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
  | 'callout'
  | 'callout-note'
  | 'callout-tip'
  | 'callout-success'
  | 'callout-important'
  | 'callout-warning'
  | 'callout-caution'
  | 'callout-danger'
  | 'callout-info'
  | 'save'
  | 'print'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'window'
  | 'tab-new'
  | 'import'
  | 'rename'
  | 'reveal'
  | 'zoom-in'
  | 'zoom-out'
  | 'fullscreen'
  | 'word-count'
  | 'table'
  | 'code'
  | 'math'
  | 'quote'
  | 'list-ordered'
  | 'task'
  | 'image'
  | 'heading'
  | 'history'
  | 'snapshot'
  | 'privacy'
  | 'hr'
  | 'footnote'
  | 'emoji'
  | 'template'
  | 'help'
  | 'help-circle'
  | 'find'
  | 'link'
  | 'text-bold'
  | 'text-italic'
  | 'text-underline'
  | 'text-strike'
  | 'text-highlight'
  | 'text-color'
  | 'visibility-show'
  | 'visibility-hide'
  | 'minimize'
  | 'tile'

export const iconRegistry: Record<Exclude<SemanticIconName, 'app-mark'>, LucideIcon> = {
  workspace: Folder,
  'workspace-open': FolderOpen,
  'workspace-tree': FolderTree,
  note: FileText,
  'note-new': FilePlus,
  graph: Network,
  backlinks: CornerDownLeft,
  assets: Paperclip,
  tags: Tag,
  frontmatter: FileJson,
  embeds: Paperclip,
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
  callout: MessageSquare,
  'callout-note': StickyNote,
  'callout-info': Info,
  'callout-tip': Lightbulb,
  'callout-success': CircleCheck,
  'callout-important': BadgeCheck,
  'callout-warning': TriangleAlert,
  'callout-caution': OctagonAlert,
  'callout-danger': ShieldAlert,
  save: Save,
  print: Printer,
  delete: Trash2,
  undo: Undo2,
  redo: Redo2,
  cut: Scissors,
  copy: Copy,
  paste: ClipboardPaste,
  window: AppWindow,
  'tab-new': SquarePlus,
  import: Upload,
  rename: PenLine,
  reveal: LocateFixed,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  fullscreen: Maximize,
  'word-count': WholeWord,
  table: Table,
  code: Code,
  math: Calculator,
  quote: Quote,
  'list-ordered': ListOrdered,
  task: CheckSquare,
  image: Image,
  heading: Heading,
  history: History,
  snapshot: Camera,
  privacy: Shield,
  hr: Minus,
  footnote: Superscript,
  emoji: Smile,
  template: LayoutTemplate,
  help: BookOpen,
  'help-circle': CircleHelp,
  find: Search,
  link: Link2,
  'text-bold': Bold,
  'text-italic': Italic,
  'text-underline': Underline,
  'text-strike': Strikethrough,
  'text-highlight': Highlighter,
  'text-color': Baseline,
  'visibility-show': Eye,
  'visibility-hide': EyeOff,
  minimize: Minimize2,
  tile: Maximize,
}
