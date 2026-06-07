import type { AppLanguageSetting } from '../settings/appSettingsTypes'
import { resolveEffectiveUiLocale, type UiLocaleId } from './resolveLocale'

const WEB_STORAGE_KEY = 'Lunote:appSettings:v1'
const LEGACY_WEB_STORAGE_KEY = 'CrossPlatNote:appSettings:v1'

export type BootMessages = {
  starting: string
  failedTitle: string
  failedMessage: string
  retry: string
}

const BOOT_MESSAGES: Record<UiLocaleId, BootMessages> = {
  en: {
    starting: 'Starting…',
    failedTitle: 'Startup failed',
    failedMessage:
      'The app failed to complete initialization, but you can try again. If it continues to fail, please check the error message below.',
    retry: 'Retry',
  },
  'zh-CN': {
    starting: '正在启动…',
    failedTitle: '启动失败',
    failedMessage: '应用未能完成初始化，你可以重试。若问题持续，请查看下方错误信息。',
    retry: '重试',
  },
  'zh-TW': {
    starting: '正在啟動…',
    failedTitle: '啟動失敗',
    failedMessage: '應用程式未能完成初始化，你可以重試。若問題持續，請查看下方錯誤訊息。',
    retry: '重試',
  },
  ja: {
    starting: '起動中…',
    failedTitle: '起動に失敗しました',
    failedMessage:
      '初期化を完了できませんでした。再試行できます。問題が続く場合は、下のエラーメッセージを確認してください。',
    retry: '再試行',
  },
  ko: {
    starting: '시작 중…',
    failedTitle: '시작 실패',
    failedMessage:
      '초기화를 완료하지 못했습니다. 다시 시도할 수 있습니다. 문제가 계속되면 아래 오류 메시지를 확인하세요.',
    retry: '다시 시도',
  },
  de: {
    starting: 'Wird gestartet…',
    failedTitle: 'Start fehlgeschlagen',
    failedMessage:
      'Die Initialisierung konnte nicht abgeschlossen werden. Sie können es erneut versuchen. Bei anhaltenden Problemen prüfen Sie die Fehlermeldung unten.',
    retry: 'Erneut versuchen',
  },
  fr: {
    starting: 'Démarrage…',
    failedTitle: 'Échec du démarrage',
    failedMessage:
      "L'application n'a pas pu terminer l'initialisation. Vous pouvez réessayer. Si le problème persiste, consultez le message d'erreur ci-dessous.",
    retry: 'Réessayer',
  },
  es: {
    starting: 'Iniciando…',
    failedTitle: 'Error al iniciar',
    failedMessage:
      'La aplicación no pudo completar la inicialización. Puede reintentar. Si el problema continúa, revise el mensaje de error abajo.',
    retry: 'Reintentar',
  },
  ru: {
    starting: 'Запуск…',
    failedTitle: 'Ошибка запуска',
    failedMessage:
      'Не удалось завершить инициализацию. Можно повторить попытку. Если проблема сохраняется, проверьте сообщение об ошибке ниже.',
    retry: 'Повторить',
  },
  pt: {
    starting: 'Iniciando…',
    failedTitle: 'Falha ao iniciar',
    failedMessage:
      'O app não concluiu a inicialização. Você pode tentar novamente. Se o problema persistir, veja a mensagem de erro abaixo.',
    retry: 'Tentar novamente',
  },
  it: {
    starting: 'Avvio…',
    failedTitle: 'Avvio non riuscito',
    failedMessage:
      "L'app non ha completato l'inizializzazione. Puoi riprovare. Se il problema persiste, controlla il messaggio di errore sotto.",
    retry: 'Riprova',
  },
}

function readStoredLanguageSetting(): string | undefined {
  try {
    let raw = localStorage.getItem(WEB_STORAGE_KEY)
    if (!raw) raw = localStorage.getItem(LEGACY_WEB_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { language?: string }
    return typeof parsed.language === 'string' ? parsed.language : undefined
  } catch {
    return undefined
  }
}

export function getBootMessages(): BootMessages {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : undefined
  const storedLang = readStoredLanguageSetting()
  const languageSetting = (storedLang ?? 'system') as AppLanguageSetting
  const locale = resolveEffectiveUiLocale(languageSetting, navLang)
  return BOOT_MESSAGES[locale] ?? BOOT_MESSAGES.en
}
