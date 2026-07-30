import { Head } from "fresh/runtime";
import type { RuntimeSettings } from "../runtime/settings.ts";
import { type CacheHealthState, define } from "../utils.ts";
import SettingsSaveButton from "../islands/SettingsSaveButton.tsx";

type FieldErrors = Partial<
  Record<
    | "relays"
    | "indexerRelays"
    | "lookupRelays"
    | "localRelay"
    | "blossomServers",
    string
  >
>;

interface SettingsPageProps {
  readonly values: RuntimeSettings;
  readonly raw?: Record<string, string>;
  readonly errors?: FieldErrors;
  readonly success?: boolean;
  readonly persistenceError?: boolean;
  readonly health?: CacheHealthState;
}

function lines(body: URLSearchParams, name: string): string[] {
  return (body.get(name) ?? "").split(/\r?\n/).map((value) => value.trim())
    .filter(Boolean);
}

function canonical(values: string[], protocols: string[]): string[] {
  return [
    ...new Set(values.map((value) => {
      const url = new URL(value);
      if (!protocols.includes(url.protocol)) throw new Error();
      if (url.username || url.password) throw new Error();
      return url.href;
    })),
  ];
}

export function parseSettingsForm(
  body: URLSearchParams,
  blockedRelays: readonly string[],
) {
  const names = [
    "relays",
    "indexerRelays",
    "lookupRelays",
    "localRelay",
    "blossomServers",
  ] as const;
  const raw = Object.fromEntries(
    names.map((name) => [name, body.get(name) ?? ""]),
  );
  const errors: FieldErrors = {};
  const relay = (name: keyof FieldErrors, optional = false): string[] => {
    try {
      const values = optional && !raw[name] ? [] : lines(body, name);
      return canonical(values, ["ws:", "wss:"]);
    } catch {
      errors[name] = "Enter valid WebSocket relay URLs.";
      return [];
    }
  };
  const relays = relay("relays");
  const indexerRelays = relay("indexerRelays");
  const lookupRelays = relay("lookupRelays");
  const local = relay("localRelay", true);
  let blossomServers: string[] = [];
  try {
    blossomServers = canonical(lines(body, "blossomServers"), [
      "http:",
      "https:",
    ]);
  } catch {
    errors.blossomServers = "Enter valid HTTP or HTTPS Blossom server URLs.";
  }
  const blocked = new Set(blockedRelays);
  const eligible = new Set([...relays, ...indexerRelays, ...lookupRelays]);
  const authRelays = body.getAll("authRelays").flatMap((value) => {
    try {
      return canonical([value], ["ws:", "wss:"]);
    } catch {
      return [];
    }
  }).filter((value) => eligible.has(value) && !blocked.has(value));
  if (Object.keys(errors).length) return { ok: false as const, raw, errors };
  return {
    ok: true as const,
    values: {
      relays,
      remoteSignerRelays: [],
      blossomServers,
      indexerRelays,
      lookupRelays,
      localRelay: local[0] ?? "",
      authRelays,
      blockedRelays: [...blockedRelays],
    } satisfies RuntimeSettings,
  };
}

function SettingsDocument(props: SettingsPageProps) {
  return (
    <>
      <Head>
        <title>Runtime settings - Napplet Portal</title>
        <meta name="theme-color" content="#F8FAFC" />
      </Head>
      <RuntimeSettingsPage {...props} />
    </>
  );
}

export const handler = define.handlers({
  GET(ctx) {
    return ctx.render(
      <SettingsDocument
        {...{
          values: ctx.state.settings.settings,
          health: ctx.state.cacheHealth,
        }}
      />,
    );
  },
  async POST(ctx) {
    const form = await ctx.req.formData();
    const body = new URLSearchParams();
    for (const [key, value] of form) {
      if (typeof value === "string") body.append(key, value);
    }
    const parsed = parseSettingsForm(
      body,
      ctx.state.settings.settings.blockedRelays,
    );
    if (!parsed.ok) {
      return ctx.render(
        <SettingsDocument
          {...{
            values: ctx.state.settings.settings,
            raw: parsed.raw,
            errors: parsed.errors,
            health: ctx.state.cacheHealth,
          }}
        />,
        { status: 400 },
      );
    }
    try {
      await ctx.state.settings.save({
        ...parsed.values,
        remoteSignerRelays: ctx.state.settings.settings.remoteSignerRelays,
      });
      return ctx.render(
        <SettingsDocument
          {...{
            values: ctx.state.settings.settings,
            success: true,
            health: ctx.state.cacheHealth,
          }}
        />,
      );
    } catch {
      return ctx.render(
        <SettingsDocument
          {...{
            values: parsed.values,
            persistenceError: true,
            health: ctx.state.cacheHealth,
          }}
        />,
        { status: 500 },
      );
    }
  },
});

function value(
  props: SettingsPageProps,
  name: keyof FieldErrors,
  values: readonly string[] | string,
) {
  return props.raw?.[name] ??
    (typeof values === "string" ? values : values.join("\n"));
}

export function RuntimeSettingsPage(props: SettingsPageProps) {
  const health = props.health ?? { relay: "checking", blossom: "checking" };
  const eligible = [
    ...new Set([
      ...props.values.relays,
      ...props.values.indexerRelays,
      ...props.values.lookupRelays,
    ]),
  ].filter((relay) => !props.values.blockedRelays.includes(relay));
  return (
    <main class="settings-page">
      <h1>Runtime settings</h1>
      {props.success && (
        <p class="settings-success" role="status">
          Settings saved. New operations will use these values.
        </p>
      )}
      {props.errors && (
        <p class="settings-error-summary" role="alert">
          Some settings could not be saved. Review the highlighted fields and
          try again.
        </p>
      )}
      {props.persistenceError && (
        <p class="settings-error-summary" role="alert">
          Settings could not be saved. Your previous settings are still active.
          Try again.
        </p>
      )}
      <CacheHealthSummary health={health} />
      <form method="post" class="settings-form">
        <fieldset>
          <legend>Relay routing</legend>
          <UrlListField
            name="relays"
            label="Fallback and extra relays"
            value={value(props, "relays", props.values.relays)}
            error={props.errors?.relays}
          />
          <UrlListField
            name="indexerRelays"
            label="Default indexer relays"
            value={value(props, "indexerRelays", props.values.indexerRelays)}
            error={props.errors?.indexerRelays}
          />
          <UrlListField
            name="lookupRelays"
            label="Default lookup relays"
            value={value(props, "lookupRelays", props.values.lookupRelays)}
            error={props.errors?.lookupRelays}
          />
          <UrlListField
            name="localRelay"
            label="Local relay cache"
            value={value(props, "localRelay", props.values.localRelay)}
            error={props.errors?.localRelay}
            optional
          />
        </fieldset>
        <fieldset>
          <legend>Relay authentication</legend>
          {eligible.length === 0 && <p>No relays available for AUTH.</p>}
          {eligible.map((relay) => (
            <AuthRelayRow
              relay={relay}
              checked={props.values.authRelays.includes(relay)}
            />
          ))}
          {props.values.blockedRelays.map((relay) => (
            <AuthRelayRow relay={relay} blocked />
          ))}
        </fieldset>
        <fieldset>
          <legend>Blossom servers</legend>
          <UrlListField
            name="blossomServers"
            label="Blossom servers"
            value={value(props, "blossomServers", props.values.blossomServers)}
            error={props.errors?.blossomServers}
          />
        </fieldset>
        <SettingsSaveButton />
      </form>
    </main>
  );
}

function UrlListField(
  { name, label, value, error, optional = false }: {
    name: string;
    label: string;
    value: string;
    error?: string;
    optional?: boolean;
  },
) {
  const errorId = `${name}-error`;
  return (
    <label class="settings-field">
      <span>{label}{optional && " (optional)"}</span>
      <textarea
        name={name}
        rows={3}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <small>One URL per line.</small>
      {error && <strong id={errorId} class="field-error">{error}</strong>}
    </label>
  );
}

function AuthRelayRow(
  { relay, checked = false, blocked = false }: {
    relay: string;
    checked?: boolean;
    blocked?: boolean;
  },
) {
  return (
    <div class="auth-relay-row">
      <span class="auth-relay-url" title={relay} aria-label={relay}>
        {relay}
      </span>
      <label>
        <input
          type="checkbox"
          name="authRelays"
          value={relay}
          checked={checked && !blocked}
          disabled={blocked}
        />{" "}
        Allow NIP-42 AUTH
      </label>
      <small>
        {blocked
          ? "Blocked — connection and AUTH disabled"
          : checked
          ? "Allowed"
          : "Not allowed"}
      </small>
    </div>
  );
}

function CacheHealthSummary({ health }: { health: CacheHealthState }) {
  const copy = (kind: "relay" | "blossom", state: CacheHealthState["relay"]) =>
    state === "checking"
      ? `Checking local ${kind === "relay" ? "relay cache" : "Blossom cache"}…`
      : state === "healthy"
      ? "Local cache available"
      : `Local ${
        kind === "relay" ? "relay" : "Blossom"
      } cache unavailable — using upstream ${
        kind === "relay" ? "relays" : "servers"
      }.`;
  return (
    <section
      class="cache-health"
      aria-label="Local cache health"
      aria-live="polite"
    >
      <p>{copy("relay", health.relay)}</p>
      <p>{copy("blossom", health.blossom)}</p>
    </section>
  );
}

export default define.page(function Settings(ctx) {
  return (
    <SettingsDocument
      values={ctx.state.settings.settings}
      health={ctx.state.cacheHealth}
    />
  );
});
