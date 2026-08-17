import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  useCanvasState,
} from "cursor/canvas";

type Tab =
  | "thesis"
  | "persona"
  | "parity"
  | "privacy"
  | "must"
  | "surfaces"
  | "steal"
  | "github"
  | "build"
  | "legal";

const TABS: { id: Tab; label: string }[] = [
  { id: "thesis", label: "Тезис" },
  { id: "persona", label: "Кто ты" },
  { id: "parity", label: "Ядро как Telegram" },
  { id: "privacy", label: "Приватность" },
  { id: "must", label: "Модерация и статусы" },
  { id: "surfaces", label: "Оболочки и рынки" },
  { id: "steal", label: "Что взять" },
  { id: "github", label: "GitHub позже" },
  { id: "build", label: "Как строить" },
  { id: "legal", label: "Право и авторы" },
];

export default function ChettikProductPlan() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "thesis");

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>Chettik — мессенджер</H1>
        <Text tone="secondary">
          Приватность — принцип номер один. По умолчанию обычный мессенджер:
          фичи как в Telegram, на телефоне оболочка Telegram, на ПК — Discord.
          Запуск: СНГ включая РФ, EU, US, CA. Китай вне скоупа. GitHub — позже.
        </Text>
        <Row gap={8} wrap>
          {TABS.map((item) => {
            const id = item.id;
            return (
              <Pill active={tab === id} onClick={() => setTab(id)}>
                {item.label}
              </Pill>
            );
          })}
        </Row>
      </Stack>

      {tab === "thesis" ? <Thesis /> : null}
      {tab === "persona" ? <Persona /> : null}
      {tab === "parity" ? <Parity /> : null}
      {tab === "privacy" ? <Privacy /> : null}
      {tab === "must" ? <MustHave /> : null}
      {tab === "surfaces" ? <SurfacesAndMarkets /> : null}
      {tab === "steal" ? <Steal /> : null}
      {tab === "github" ? <GithubLater /> : null}
      {tab === "build" ? <BuildPlan /> : null}
      {tab === "legal" ? <LegalPlan /> : null}
    </Stack>
  );
}

function Thesis() {
  return (
    <Stack gap={20}>
      <Callout tone="warning" title="Принцип №1 — приватность">
        Выше роста, ботов и слоя GitHub. Облачные чаты — удобный мессенджер.
        Секретные чаты, одноразовые сообщения, отложенная отправка и медиа по
        таймеру — ядро продукта, не «потом». Не инструмент скрывать преступления:
        обычная переписка, которую человек контролирует сам.
      </Callout>

      <Callout tone="info" title="Продукт по умолчанию">
        Chettik — удобный мессенджер для всех. Набор фич как в Telegram: лички,
        группы, сохранённые, сторис, голосовые, кружки. На телефоне раскладка
        как в Telegram, на ПК — как в Discord (сайдбар). Программист — тот же
        мессенджер; GitHub не дом.
      </Callout>

      <Grid columns={3} gap={12}>
        <Stat value="Приватность" label="Главный принцип продукта" tone="info" />
        <Stat value="Telegram / Discord" label="Фичи+телефон / шелл ПК" />
        <Stat value="СНГ+РФ / EU / US / CA" label="Рынки запуска" />
      </Grid>

      <H2>Интерфейс</H2>
      <Text>
        Современный UI. Цвета: тёмно-красные акценты под тему хоста, без своего
        hex-бренда. Обязательны dark и light. Раскладка зависит от поверхности:
        плотный Discord-шелл на широком экране, Telegram-шелл на узком. Один
        продукт, два шелла — по viewport/платформе, не два разных приложения.
      </Text>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>Темы</CardHeader>
          <CardBody>
            <Text size="small">
              Dark и Light обязательны с первого дня. Переключатель в
              настройках. Акцент dark-red следует токенам хоста.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Языки</CardHeader>
          <CardBody>
            <Text size="small">
              Русский и English обязательны с дня один (i18n). Переключатель в
              настройках. Не «потом переведём».
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Что это не есть</H2>
      <Table
        headers={["Запрет", "Почему"]}
        rows={[
          [
            "Дом = programmer HQ / PR-комнаты",
            "Это вторичный слой. Ядро — обычный мессенджер",
          ],
          [
            "Интеграция VS Code / Cursor",
            "Нет. Ни в v1, ни позже. Клиенты: web, iOS, Android",
          ],
          [
            "GitHub как вход по умолчанию",
            "Личность — телефон. GitHub только привязка у программиста",
          ],
          [
            "Mute / CODEOWNERS как дефолт",
            "Все пишут, как в группе Telegram",
          ],
          [
            "Боты в v1",
            "Да, но позже. Не блокируют запуск мессенджера",
          ],
          [
            "Приватность как укрытие преступления",
            "Нет. Контроль своей переписки, не обход закона",
          ],
          [
            "Китай / WeChat-first",
            "Вне скоупа. Закрытая экосистема, сейчас не фокус",
          ],
          [
            "Голосовые / видеозвонки в v1",
            "Не сейчас. Голосовые сообщения и кружки — да",
          ],
        ]}
        rowTone={["danger", "danger", "danger", "warning", "info", "warning", "neutral", "warning"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Жёсткие решения продукта · Chettik brief · август 2026
      </Text>
    </Stack>
  );
}

function Persona() {
  return (
    <Stack gap={20}>
      <H2>Регистрация</H2>
      <Table
        headers={["Шаг", "Что видит человек", "Обязательно"]}
        rows={[
          [
            "1. Телефон",
            "Номер — личность аккаунта. Сначала SMS OTP. Если SMS не дошло — «получить код в Telegram». Не вход аккаунтом Telegram",
            "Да, для всех",
          ],
          [
            "2. Кто ты",
            "«Общаюсь с людьми» или «Пишу код». Дом всё равно мессенджер",
            "Да, можно сменить в настройках",
          ],
          [
            "3. Профиль",
            "Имя, username, аватарки. Язык RU/EN, тема dark/light",
            "Да",
          ],
          [
            "4. Привязки",
            "Опционально: Discord и/или GitHub на профиль. Не шаг регистрации. Можно пропустить",
            "Нет. Не требуем ни Discord, ни GitHub чтобы войти",
          ],
        ]}
        rowTone={["info", "info", "success", "neutral"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Онбординг · телефон = source of truth · SMS OTP, затем fallback код в
        Telegram · Discord/GitHub = опциональные привязки профиля
      </Text>

      <Callout tone="info" title="Доставка OTP">
        Ввод номера → SMS с кодом. Если SMS не пришло или недоступно — кнопка
        получить тот же одноразовый код в Telegram. Нужно там, где SMS в СНГ/РФ,
        EU, US, CA бывает ненадёжным. Это доставка кода, не смена личности и не
        обход закона. Китай вне скоупа.
      </Callout>

      <Callout tone="warning" title="Дом один">
        После регистрации оба типа пользователей попадают в обычный мессенджер:
        чаты, группы, Saved Messages, сторис. Режим «программист» не меняет
        стартовый экран на список репозиториев.
      </Callout>

      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Text size="small">по умолчанию</Text>}>
            Обычный человек
          </CardHeader>
          <CardBody>
            <Text size="small">
              Telegram-паритет: лички, группы, каналы-ощущение групп, сторис,
              кружки, голосовые, контакты, опросы. GitHub нет и не нужен.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">тот же чат</Text>}>
            Программист
          </CardHeader>
          <CardBody>
            <Text size="small">
              Тот же мессенджер. GitHub можно привязать позже и открыть слой
              репо. Без привязки продукт полный: это не «урезанный Slack».
            </Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function Parity() {
  return (
    <Stack gap={20}>
      <H2>Ядро v1 — паритет с Telegram</H2>
      <Text>
        Это обязательный чеклист, не идеи «когда-нибудь». Ощущение Telegram, не
        Slack: быстрые чаты, медиа из пальца, открытые группы.
      </Text>
      <Table
        headers={["Фича", "RU / EN", "В v1", "Как в Telegram"]}
        rows={[
          ["Имя", "Name / display name", "Да", "Как тебя видят в чатах"],
          ["Username", "Username", "Да", "@handle, поиск людей"],
          ["Несколько аватарок", "Multiple avatars", "Да", "Набор фото профиля"],
          ["Чаты 1:1", "Chats", "Да", "Лички"],
          ["Группы", "Groups", "Да", "Все пишут, если не канал-broadcast"],
          ["Избранное", "Saved Messages", "Да", "Чат с собой"],
          ["Сторис", "Stories", "Да", "Исчезающие круги наверху"],
          ["Кружки", "Circles / video notes", "Да", "Круглые видеосообщения"],
          ["Голосовые", "Voice messages", "Да", "Зажал — записал"],
          ["Опросы", "Polls", "Да", "Голосование в чате и группе"],
          ["Форматирование текста", "Text formatting", "Да", "bold, italic, code, ссылки"],
          ["Геолокация", "Location", "Да", "Точка на карте в сообщении"],
          ["Контакты", "Contacts", "Да", "Книга, шаринг контакта, инвайт"],
          [
            "Фото и видео",
            "Photo / video",
            "Да, must",
            "Сжатая галерея, подпись, альбом если несколько",
          ],
          [
            "Любые файлы",
            "Any files",
            "Да, must",
            "Документ как есть, не только картинки",
          ],
          [
            "Фото как файл",
            "Photo as file / document",
            "Да, must",
            "Без сжатия галереи, send as document",
          ],
          [
            "Секретные чаты",
            "Secret chats",
            "Да, рано",
            "E2E, привязка к устройству, не облачный чат",
          ],
          [
            "Одноразовые",
            "View-once",
            "Да, рано",
            "Открыл один раз — исчезло",
          ],
          [
            "Отложенная отправка",
            "Scheduled send",
            "Да, рано",
            "Таймер на время отправки, не self-destruct",
          ],
          [
            "Медиа по таймеру",
            "Timed image/video",
            "Да, рано",
            "Фото/видео исчезает по таймеру",
          ],
        ]}
        rowTone={[
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "success",
          "info",
          "info",
          "info",
          "info",
        ]}
        striped
      />
      <Text size="small" tone="tertiary">
        Чеклист ядра v1 · паритет Telegram · Chettik brief · август 2026
      </Text>

      <H2>В чатах копируем ядро Telegram</H2>
      <Text>
        UX переписки — Telegram, не Slack. Короткий список обязательного в
        каждом чате, плюс блок/репорт/удаление с двух сторон (вкладка
        «Модерация и статусы»).
      </Text>
      <Table
        headers={["Действие", "В v1"]}
        rows={[
          ["Ответ / переслать / изменить / закрепить", "Да"],
          ["Поиск по чату", "Да"],
          ["Реакции (как в Telegram)", "Да"],
          [
            "Фото/видео, любой файл, фото как документ (без сжатия)",
            "Да, must",
          ],
          ["Блок, репорт, удалить сообщение с двух сторон", "Да, must"],
          ["Удалить чат с двух сторон", "Да, must"],
        ]}
        rowTone={["success", "success", "success", "info", "info", "info"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Telegram core in chats · не полный дамп API · август 2026
      </Text>

      <H2>Рядом с ядром, но не Slack</H2>
      <Callout tone="warning" title="Звонки — не сейчас">
        Voice/video calls и huddle в ранний план не входят. Голосовые сообщения
        и кружки остаются: это не звонки.
      </Callout>
      <Card>
        <CardHeader>Каналы</CardHeader>
        <CardBody>
          <Text size="small">
            Broadcast, когда явно создали канал. Комментарии можно включить. Не
            путать с «workspace Slack».
          </Text>
        </CardBody>
      </Card>

      <Callout tone="neutral" title="Боты">
        Создавать ботов — да, но позже. Исключение: системный бот уведомления о
        входе с нового устройства — рано, вместе с сессиями. Маркетплейса в v1
        нет.
      </Callout>
    </Stack>
  );
}

function Privacy() {
  return (
    <Stack gap={20}>
      <Callout tone="warning" title="Выше всего остального">
        Приватность — не слой «для параноиков». Четыре фичи ниже — разные вещи,
        все first-class. Не прятать преступления: контроль обычной переписки.
      </Callout>

      <H2>Четыре разные фичи</H2>
      <Table
        headers={["Фича", "Что это", "Что это не есть"]}
        rows={[
          [
            "Секретные чаты",
            "E2E, привязка к устройству, как Telegram secret chats. Копии в облаке нет, хранение локально на устройстве",
            "Не обычный облачный чат. Не «все чаты E2E с первого дня»",
          ],
          [
            "Одноразовые сообщения",
            "View-once: открыл один раз — сообщение исчезло",
            "Не отложенная отправка и не таймер на медиа",
          ],
          [
            "Отложенная отправка",
            "Scheduled send: выбрать время в будущем, тогда уйдёт",
            "Не self-destruct и не view-once",
          ],
          [
            "Медиа по таймеру",
            "Фото/видео с таймером исчезновения, как в secret chat / view-once media",
            "Не сторис и не scheduled send",
          ],
        ]}
        rowTone={["info", "info", "info", "info"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Модель приватности · как Telegram · Chettik brief · август 2026
      </Text>

      <H2>Рядом, тоже Telegram-like</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>Секретный чат</CardHeader>
          <CardBody>
            <Text size="small">
              Нет облачной копии. Скриншот — уведомление там, где платформа
              позволяет. Только это устройство.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Звонки</CardHeader>
          <CardBody>
            <Text size="small">
              Не в раннем плане. Голосовые сообщения и кружки — да.
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Кому видно — как в Telegram</H2>
      <Text>
        Для каждого поля: все / никто / только контакты / исключения «всегда
        видят» / «никогда не видят».
      </Text>
      <Table
        headers={["Поле", "Аудитория"]}
        rows={[
          ["Номер телефона", "everybody / nobody / contacts / exceptions"],
          ["Last seen и онлайн", "everybody / nobody / contacts / exceptions"],
          ["Фото профиля", "everybody / nobody / contacts / exceptions"],
          ["Bio", "everybody / nobody / contacts / exceptions"],
          ["День рождения", "everybody / nobody / contacts / exceptions"],
          ["Пересланные сообщения", "everybody / nobody / contacts / exceptions"],
          ["Голосовые сообщения", "everybody / nobody / contacts / exceptions"],
          ["Сообщения", "everybody / nobody / contacts / exceptions"],
        ]}
        striped
      />
      <Text size="small" tone="tertiary">
        Granular privacy · Telegram audience model · август 2026
      </Text>

      <H2>Устройства</H2>
      <Table
        headers={["Фича", "В v1", "Как"]}
        rows={[
          [
            "Несколько устройств",
            "Must",
            "Список сессий: имя, IP/страна, last active, завершить сессию",
          ],
          [
            "Вход по QR",
            "Must",
            "Как Telegram: отсканировать QR на новом устройстве",
          ],
          [
            "QR профиля",
            "Must",
            "Поделиться профилем через QR",
          ],
          [
            "Системный бот входа",
            "Must, рано",
            "Сообщение: аккаунт вошёл с устройства X из страны Y. Системный бот, не пользовательские боты",
          ],
        ]}
        rowTone={["info", "info", "info", "info"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Sessions + QR · как Telegram · август 2026
      </Text>

      <H2>Настройки аккаунта</H2>
      <Table
        headers={["Пункт", "Заметка"]}
        rows={[
          ["Заблокированные", "Список, снять блок"],
          ["Passcode / Face ID", "Локальный замок приложения, не замена OTP"],
          ["Two-step verification", "Облачный второй фактор"],
          ["Passkeys", "Да, must"],
          ["Auto-delete messages", "Автоудаление сообщений в чатах"],
          ["Login email", "Почта для входа/восстановления, личность всё равно телефон"],
          [
            "Удалить аккаунт автоматически",
            "1 / 3 / 6 / 12 / 18 / 24 месяца без активности",
          ],
        ]}
        striped
      />
      <Text size="small" tone="tertiary">
        Settings · Telegram-like · не после GitHub · август 2026
      </Text>

      <Callout tone="neutral" title="Порядок сборки">
        Облачные чаты → модерация → устройства/настройки/видимость →
        scheduled/view-once/timed media → секретные чаты. Звонки не в этой
        очереди. Пользовательские боты позже; системный бот «новый вход» — рано.
      </Callout>
    </Stack>
  );
}

function MustHave() {
  return (
    <Stack gap={20}>
      <Callout tone="warning" title="Обязательно в раннем v1">
        Блокировки, репорты, удаление с двух сторон, админ-консоль и бейджи —
        не «потом» и не после GitHub. Это must. Админка — внутренний ops,
        не роли Discord у обычного пользователя.
      </Callout>

      <H2>Модерация как в Telegram</H2>
      <Table
        headers={["Фича", "Что делает", "Статус"]}
        rows={[
          [
            "Блокировки",
            "Block: человек не пишет тебе, как в Telegram",
            "Must, рано",
          ],
          [
            "Репорты",
            "Жалоба на пользователя, сообщение, чат — очередь в админку",
            "Must, рано",
          ],
          [
            "Удалить сообщение с двух сторон",
            "Сообщение пропадает у обоих, не только «удалить у себя»",
            "Must, рано",
          ],
          [
            "Удалить чат с двух сторон",
            "Чат исчезает у обоих участников",
            "Must, рано",
          ],
        ]}
        rowTone={["info", "info", "info", "info"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Destructive actions · Telegram-like · Chettik brief · август 2026
      </Text>

      <H2>Админ-меню Chettik</H2>
      <Text>
        Отдельная внутренняя консоль: пользователи, репорты, баны, контент,
        feature flags. Не меню ролей в клиенте. First-class: без неё нельзя
        запускать продукт с репортами.
      </Text>
      <Card>
        <CardHeader>Ops console</CardHeader>
        <CardBody>
          <Text size="small">
            Доступ только у сотрудников. RU/EN, dark/light. Связана с очередью
            репортов и блокировками. Не путать с админом группы у пользователей.
          </Text>
        </CardBody>
      </Card>

      <H2>Бейджи как в Discord</H2>
      <Text>
        Бейджи в профиле обязательны: staff, partner, кастомные ачивки. Видны
        в профиле и рядом с именем там, где уместно. Не заменяют приписку в
        чате.
      </Text>

      <H2>Статусы и приписка</H2>
      <Table
        headers={["Что", "Откуда вкус", "Как"]}
        rows={[
          [
            "Presence",
            "Discord",
            "online / idle / dnd / offline / custom",
          ],
          [
            "Custom status",
            "Discord",
            "Свой текст статуса",
          ],
          [
            "Приписка в чатах",
            "Telegram",
            "Подпись под именем в списке чатов: about / bio / описание чата / строка статуса",
          ],
        ]}
        rowTone={["info", "info", "success"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Presence + приписка · оба обязательны · август 2026
      </Text>

      <H2>Привязки в профиле</H2>
      <Text>
        Человек может подключить Discord и GitHub к аккаунту Chettik. На
        публичной странице профиля видны связанные аккаунты (username / бейдж).
        Регистрация по-прежнему только телефон. Discord и GitHub не обязательны.
      </Text>
      <Table
        headers={["Связь", "Зачем", "Не является"]}
        rows={[
          [
            "Discord OAuth",
            "Подключить и показать Discord на профиле",
            "Не вход в Chettik. Не обязателен при регистрации",
          ],
          [
            "GitHub OAuth",
            "Показать GitHub на профиле. У программиста позже — ещё и слой репо",
            "Не главный логин. Обычный пользователь может не привязывать",
          ],
        ]}
        rowTone={["info", "info"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Connected accounts · optional social links · телефон остаётся личностью ·
        август 2026
      </Text>
    </Stack>
  );
}

function SurfacesAndMarkets() {
  return (
    <Stack gap={20}>
      <H2>Два шелла, один продукт</H2>
      <Text>
        Бренд один: dark-red, dark и light. Меняется только раскладка. На ПК —
        плотный Discord-шелл (колонка серверов/папок, каналы, широкий чат). На
        телефоне — Telegram-шелл (список чатов, большой композитор, сторис
        сверху). Не два кода ради двух брендов: один клиент, выбор шелла по
        платформе и ширине viewport.
      </Text>
      <Table
        headers={["Поверхность", "Шелл", "Как ощущается"]}
        rows={[
          [
            "Нативное приложение на ПК",
            "Discord-like",
            "Сайдбар, плотный десктоп-хром, много панелей сразу",
          ],
          [
            "Web на ПК",
            "Discord-like",
            "Тот же десктоп-шелл в браузере, не узкая колонка Telegram",
          ],
          [
            "Нативное приложение на телефоне",
            "Telegram-like",
            "Список чатов, сторис, кружки и голосовые из пальца",
          ],
          [
            "Web на телефоне",
            "Telegram-like",
            "Тот же мобильный шелл в браузере / PWA",
          ],
        ]}
        rowTone={["info", "info", "success", "success"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Контракт UX · Discord = десктопная раскладка · Telegram = телефонная
        раскладка + набор фич · Chettik brief · август 2026
      </Text>

      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>ПК (app + web)</CardHeader>
          <CardBody>
            <Text size="small">
              Оболочка как Discord: левая колонка пространств/папок, список
              каналов и личек, основной чат. Фичи всё равно ядра Telegram
              (кружки, сторис, Saved Messages) — просто в десктопной сетке.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Телефон (app + web)</CardHeader>
          <CardBody>
            <Text size="small">
              Оболочка как Telegram: один главный список, свайпы, запись голоса
              и кружка без десктопных панелей.
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Рынки запуска</H2>
      <Text>
        Продукт должен открываться и логиниться с телефона в этих регионах. Это
        карта доступности запуска, не инструкция по обходу ограничений.
      </Text>
      <Table
        headers={["Регион", "В запуске", "Что это значит для продукта"]}
        rows={[
          [
            "СНГ, включая РФ",
            "Да",
            "Инфра, SMS OTP и fallback кода в Telegram доступны из РФ и СНГ",
          ],
          [
            "EU",
            "Да",
            "Сервис, SMS и fallback кода в Telegram для европейских номеров",
          ],
          [
            "US",
            "Да",
            "Хостинг достижим, SMS OTP, при сбое — код в Telegram",
          ],
          [
            "CA",
            "Да",
            "В той же карте, что US/EU",
          ],
          [
            "Китай",
            "Нет, не сейчас",
            "Закрытая экосистема. Не WeChat-first, не отдельный CN-клиент",
          ],
        ]}
        rowTone={["success", "success", "success", "success", "neutral"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Карта запуска · CIS+RF, EU, US, CA · CN вне скоупа · август 2026
      </Text>

      <Callout tone="warning" title="Ops как доступность, не как обход">
        Нужны хостинг и доставка OTP, достижимые из РФ, ЕС, США и Канады.
        Юридическая рамка запуска — эти рынки. Китай не проектируем. В план не
        закладываем обход санкций или незаконный circumvention.
      </Callout>
    </Stack>
  );
}

function Steal() {
  return (
    <Stack gap={20}>
      <H2>Откуда вкус</H2>
      <Table
        headers={["Сервис", "Роль", "Берём", "Не берём"]}
        rows={[
          [
            "Telegram",
            "Ядро фич + шелл телефона",
            "Чеклист v1, SMS OTP + fallback код, блок/репорт/удаление с двух сторон, секретные чаты, view-once, scheduled, медиа по таймеру, приписка, мобильный шелл",
            "Чужой аккаунт как зависимость",
          ],
          [
            "Discord",
            "Шелл ПК",
            "Сайдбар, плотный десктоп, бейджи, presence, OAuth на профиль",
            "Игровой хром, звонки в v1, сервер как единственный дом на телефоне",
          ],
          [
            "Slack",
            "Почти ничего",
            "Поиск по истории — позже, если не ломает простоту",
            "Mute default, #general, HQ, IDE-плагины",
          ],
          [
            "GitHub",
            "Профиль + слой позже",
            "Опциональный OAuth на профиль для всех; слой репо только у программиста позже",
            "Главный логин, обязаловка, домашний экран",
          ],
        ]}
        rowTone={["success", "info", "neutral", "warning"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Вес в продукте · Telegram = фичи и телефон · Discord = раскладка ПК ·
        август 2026
      </Text>

      <H2>Приоритет инженерии v1</H2>
      <BarChart
        categories={[
          "SMS+Telegram OTP",
          "Чаты Telegram-core",
          "Блок/репорт/админ",
          "Приватность",
          "Бейджи+presence",
          "Натив",
          "Боты",
          "Слой GitHub",
        ]}
        series={[
          {
            name: "Приоритет v1 (0–10, оценка)",
            data: [10, 10, 10, 10, 9, 7, 3, 2],
            tone: "info",
          },
        ]}
        height={240}
        yMax={10}
      />
      <Text size="small" tone="tertiary">
        Ось X — фича · ось Y — приоритет 0–10 · оценка brief · август 2026 ·
        «Приватность» = secret chats, view-once, scheduled send, timed media ·
        боты и GitHub специально низкие
      </Text>
    </Stack>
  );
}

function GithubLater() {
  return (
    <Stack gap={20}>
      <Callout tone="warning" title="Не домашний экран">
        Слой репозиториев (PR-комнаты) — позже и только у программиста. Отдельно:
        любой человек может опционально привязать GitHub или Discord и показать
        их на профиле. Это не логин и не обязаловка.
      </Callout>

      <H2>Когда вообще появляется слой репо</H2>
      <Text>
        После того как мессенджер уже удобен. Привязка GitHub на профиле может
        быть раньше. Телефон остаётся каноном личности. Discord — только
        connected account, не вход.
      </Text>

      <Table
        headers={["Элемент", "Статус", "Заметка"]}
        rows={[
          ["Телефон OTP", "Всегда", "Source of truth"],
          [
            "Discord / GitHub на профиле",
            "Опция, рано",
            "OAuth connect + показ username. Не регистрация",
          ],
          ["GitHub как второй вход / слой репо", "Опция позже", "Только программист, не дом"],
          ["PR-комнаты / CI", "После v1", "Не стартовый экран"],
          ["CODEOWNERS mute", "Нет как дефолт", "Все пишут"],
          ["VS Code / Cursor", "Нет", "Не делаем клиент-расширение"],
        ]}
        rowTone={["success", "info", "neutral", "neutral", "warning", "danger"]}
        striped
      />
      <Text size="small" tone="tertiary">
        Слой GitHub · не v1 core · Chettik brief · август 2026
      </Text>

      <H3>Зачем он вообще</H3>
      <Text tone="secondary">
        Чтобы программист мог жить в том же приложении, что и семья, и при
        желании открыть репозитории. Не чтобы продукт продавался как «Slack для
        git».
      </Text>
    </Stack>
  );
}

function LegalPlan() {
  return (
    <Stack gap={20}>
      <Callout tone="warning" title="Юридические документы — часть запуска">
        Terms of Service, Privacy Policy, Community Guidelines, Copyright/IP
        policy и сведения об авторах публикуются до публичного запуска. Текст
        проходит review юриста для целевых рынков (CIS/RF, EU, US, CA).
      </Callout>
      <H2>Обязательный legal-пакет</H2>
      <Table
        headers={["Документ", "Назначение", "Статус"]}
        rows={[
          ["Terms of Service", "Правила сервиса, аккаунты, допустимое использование, модерация и прекращение доступа", "Must до launch"],
          ["Privacy Policy", "Какие данные обрабатываются, цели, хранение, права пользователя и контакты privacy", "Must до launch"],
          ["Community Guidelines", "Недопустимый контент, репорты, блокировки и порядок модерации", "Must до launch"],
          ["Copyright / IP Policy", "Жалобы об авторских правах, контент пользователей и порядок обращений", "Must до launch"],
          ["Authors / Credits", "Chettik как автор продукта, участники и лицензии third-party компонентов", "Must до launch"],
          ["Cookie / Local Storage Notice", "Web-хранилище, сессии и analytics — если применимо", "До web launch"],
          ["Data Processing & retention", "Ретенция, удаление аккаунта, auto-delete и процесс удаления данных", "До launch"],
        ]}
        rowTone={["info", "info", "info", "info", "success", "neutral", "info"]}
        striped
      />
      <H2>Требования к публикации</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>Языки и доступность</CardHeader>
          <CardBody>
            <Text size="small">
              RU и EN версии доступны из auth и Settings. Версия документа,
              дата вступления в силу и changelog видны пользователю.
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Не заменяет юриста</CardHeader>
          <CardBody>
            <Text size="small">
              Стартовые тексты — product placeholders. До запуска их проверяют
              профильные юристы на соответствие рынкам и фактической архитектуре.
            </Text>
          </CardBody>
        </Card>
      </Grid>
      <Text size="small" tone="tertiary">
        Legal readiness · RU/EN · authors and third-party notices · Chettik brief
        · август 2026
      </Text>
    </Stack>
  );
}

function BuildPlan() {
  return (
    <Stack gap={20}>
      <Callout tone="success" title="Платформы">
        Web → PWA → iOS/Android и десктоп-приложение. Web и натив на ПК —
        Discord-шелл. Web и натив на телефоне — Telegram-шелл. Нет клиента
        внутри редактора кода.
      </Callout>

      <H2>Стек под мессенджер</H2>
      <Table
        headers={["Слой", "Выбор", "Почему"]}
        rows={[
          [
            "Личность",
            "Телефон. OTP: SMS, иначе код в Telegram",
            "Номер — аккаунт. Telegram только канал доставки кода, не личность. Рынки: СНГ/РФ, EU, US, CA",
          ],
          [
            "Доступность",
            "Хостинг, достижимый из РФ + EU/US/CA",
            "Карта запуска. Китай вне скоупа. Не схема обхода ограничений",
          ],
          [
            "i18n",
            "RU + EN с дня один",
            "Переключатель в настройках",
          ],
          [
            "Тема + шелл",
            "Dark/Light; Discord на ПК, Telegram на телефоне",
            "Один клиент, шелл по viewport/платформе",
          ],
          [
            "Секретные чаты",
            "E2E на устройстве, без облачной копии",
            "После облачных чатов, до ботов и GitHub",
          ],
          [
            "Медиа",
            "Object storage: фото/видео, любые файлы, фото как документ",
            "Сжатие vs document, как в Telegram. Не звонки",
          ],
          [
            "Мобилки",
            "PWA, потом натив",
            "Telegram-шелл на телефоне обязателен",
          ],
        ]}
        striped
      />

      <H2>Этапы</H2>
      <TodoList
        todos={[
          {
            id: "m0",
            content:
              "Телефон как личность. OTP: сначала SMS, если не дошло — код в Telegram. Номера СНГ включая РФ, EU, US, CA. Хостинг достижим. «Кто ты», профиль, RU/EN, dark/light. Китай вне скоупа. Discord/GitHub не требуем для входа.",
            status: "pending",
          },
          {
            id: "m1",
            content:
              "Облачные чаты + ядро Telegram: ответ, переслать, изменить, закрепить, поиск, реакции. Фото/видео (сжатие + подпись, альбом), любые файлы, фото как документ без сжатия. Saved Messages, контакты, форматирование. Presence: online / idle / dnd / offline / custom + custom status. Приписка в списке чатов. Шелл: Discord на ПК, Telegram на телефоне.",
            status: "pending",
          },
          {
            id: "m2",
            content:
              "Must: блокировки, репорты, удаление сообщения с двух сторон, удаление чата с двух сторон. Админ-консоль (пользователи, жалобы, баны, контент, feature flags). Бейджи Discord-like (staff / partner / ачивки). Опциональная привязка Discord и GitHub на профиль (OAuth, показ на странице, не логин и не обязательна).",
            status: "pending",
          },
          {
            id: "m3",
            content:
              "Устройства и настройки: список сессий (имя, IP/страна, last active, завершить), вход по QR, QR профиля, системный бот «вход с устройства X из страны Y». Passcode/Face ID, 2FA, passkeys, login email, auto-delete messages, список блокировок. Видимость everybody/nobody/contacts/exceptions для телефона, last seen, фото, bio, ДР, форвардов, голосовых, сообщений. Автоудаление аккаунта: 1/3/6/12/18/24 мес.",
            status: "pending",
          },
          {
            id: "m4",
            content:
              "Приватность в облаке: отложенная отправка (scheduled send), одноразовые (view-once), фото/видео по таймеру.",
            status: "pending",
          },
          {
            id: "m5",
            content:
              "Секретные чаты: E2E, device-bound, без облачной копии, локальное хранение, уведомление о скриншоте где можно.",
            status: "pending",
          },
          {
            id: "m6",
            content:
              "Голосовые сообщения, кружки, геолокация, опросы, сторис. PWA, пуши. Звонков нет.",
            status: "pending",
          },
          {
            id: "m7",
            content:
              "iOS/Android (Telegram-шелл) и нативный ПК (Discord-шелл).",
            status: "pending",
          },
          {
            id: "m8",
            content:
              "Позже: пользовательские боты. Системный бот входа уже в m3. Не v1 конструктор.",
            status: "pending",
          },
          {
            id: "m9",
            content:
              "Ещё позже: слой GitHub для программиста (репо/PR). Не дом. Без IDE. Привязка на профиле уже с m2.",
            status: "pending",
          },
        ]}
      />

      <H2>Не делаем</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>Клиенты, которых нет</CardHeader>
          <CardBody>
            <Text size="small">
              Расширение VS Code, сайдбар Cursor, любой IDE-плагин — вне
              продукта, в том числе «потом».
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Не ядро v1</CardHeader>
          <CardBody>
            <Text size="small">
              Конструктор ботов, GitHub App, PR-комнаты, mute-by-default,
              WeChat-first / Китай, корпоративный Slack-workspace, голосовые и
              видеозвонки в раннем v1.
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>Успех v1</H2>
      <Text>
        Человек входит по QR, видит сессии и системное «вход из страны Y»,
        ставит 2FA/passkey и кому видно номер. Переписка как в Telegram, без
        звонков. Голосовые и кружки есть. Телефон — логин.
      </Text>
    </Stack>
  );
}
