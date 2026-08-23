[![N|Solid](https://raw.githubusercontent.com/nasriyasoftware/nasriyasoftware/refs/heads/main/assets/imgs/colorful_gradient_logo.png)](https://nasriya.net)

# Zexi

Zexi is a powerful terminal interface and CLI application framework for Node.js. It provides structured logging, interactive terminal input, dynamic terminal output, screen management, terminal events, and styling capabilities for building rich command-line applications.

[![NPM License](https://img.shields.io/npm/l/%40nasriya%2Fzexi?color=lightgreen)](https://github.com/nasriyasoftware/Zexi?tab=License-1-ov-file) [![NPM Version](https://img.shields.io/npm/v/%40nasriya%2Fzexi)](https://www.npmjs.com/package/@nasriya/zexi) [![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/%40nasriya%2Fzexi)](https://www.npmjs.com/package/@nasriya/zexi) [![Last Commit](https://img.shields.io/github/last-commit/nasriyasoftware/Zexi.svg)](https://github.com/nasriyasoftware/Zexi) [![Status](https://img.shields.io/badge/Status-Alpha-orange.svg)](https://github.com/nasriyasoftware/Zexi)

##### Visit us at [www.nasriya.net](https://nasriya.net).

Made with ❤️ in **Palestine** 🇵🇸

---

## Overview

Zexi is designed for applications that need more than simple `console.log()` output.

It provides a structured terminal environment where applications can:

* Log values using multiple severity levels.
* Capture and process terminal events.
* Collect interactive user input.
* Ask for confirmations.
* Display passwords and other sensitive input privately.
* Create dynamic terminal entries that can be updated in place.
* Build progress indicators and live status output.
* Clear and manage terminal output through a shared screen engine.
* Configure logging behavior independently for different terminal instances.
* Consume immutable JSON log events from application code.
* Render terminal output using Zexi's rendering and styling system.

The terminal API is asynchronous and designed around queued screen operations, allowing terminal updates and interactive operations to be coordinated without directly manipulating the underlying terminal screen.

## Contents

* [Why Zexi](#why-zexi)

  * [Key Capabilities](#key-capabilities)
  * [When to Use Zexi](#when-to-use-zexi)
* [Installation & Importing](#installation--importing)

  * [Installation](#installation)
  * [ESM](#esm)
  * [CommonJS](#commonjs)
* [Terminal](#terminal)

  * [Creating a Terminal Instance](#creating-a-terminal-instance)
  * [Logging](#logging)
  * [Log Levels](#log-levels)
  * [Log Metadata](#log-metadata)
  * [Log Events](#log-events)
  * [Dynamic Terminal Entries](#dynamic-terminal-entries)
  * [Interactive Prompts](#interactive-prompts)
  * [Password Input](#password-input)
  * [Input Validation](#input-validation)
  * [Confirmation Prompts](#confirmation-prompts)
  * [Timeouts and Cancellation](#timeouts-and-cancellation)
  * [Clearing the Terminal](#clearing-the-terminal)
  * [Creating Isolated Terminal Instances](#creating-isolated-terminal-instances)
* [Events](#events)
* [Building CLI Applications](#building-cli-applications)
* [Testing](#testing)
* [License](#license)

> [!IMPORTANT]
>
> 🌟 **Support Our Development!** 🌟
>
> If you find Zexi or our other software useful, consider supporting our continued development.
>
> **[Support Nasriya Software](https://fund.nasriya.net/)**

---

## Why Zexi

Building a polished CLI application often requires much more than writing text to standard output.

Applications may need structured logging, interactive prompts, validation, password handling, progress indicators, dynamic status messages, and a reliable way to react to terminal operations. Implementing these capabilities independently can quickly lead to application-specific terminal infrastructure.

Zexi provides these capabilities through a unified terminal API.

### Key Capabilities

* **Structured logging** — Log values using `debug`, `info`, `warn`, `error`, and `fatal` severity levels.
* **JSON log events** — Every log operation produces a structured immutable event that can be consumed by application code.
* **Interactive input** — Prompt users for values directly through the terminal.
* **Input privacy** — Capture input as visible text, masked passwords, or completely hidden input.
* **Input validation** — Validate user input synchronously or asynchronously before accepting it.
* **Confirmation prompts** — Provide conventional `[Y/n]` and `[y/N]` interactions.
* **Dynamic terminal entries** — Create output regions that can be updated after they are rendered.
* **Live application output** — Build progress indicators, status displays, counters, and other changing terminal content.
* **Terminal events** — Subscribe to logging and terminal lifecycle events.
* **Screen management** — Clear and update terminal output through the shared screen engine.
* **Configurable terminals** — Create multiple terminal interfaces with independent logging configuration.
* **Styling and rendering** — Produce structured and styled terminal output without directly managing terminal escape sequences.

### When to Use Zexi

Zexi is particularly useful for:

* CLI applications.
* Interactive command-line tools.
* Installation and setup programs.
* Development and administration utilities.
* Build and deployment tools.
* Server management applications.
* Database and infrastructure utilities.
* Long-running terminal processes.
* Applications that need structured logs in addition to human-readable terminal output.

Zexi can also be used as a terminal infrastructure layer inside larger Node.js applications.

---

## Installation & Importing

### Installation

Install Zexi from npm:

```bash
npm install @nasriya/zexi
```

### ESM

For ESM applications:

```ts
import zexi from '@nasriya/zexi';
```

### CommonJS

For CommonJS applications:

```js
const zexi = require('@nasriya/zexi').default;
```

---

## Terminal

The `ZexiTerminal` class provides the primary API for logging, terminal events, interactive input, dynamic entries, and screen management.

The package also exports a default terminal instance for applications that do not require separate terminal configurations.

```ts
import terminal from '@nasriya/zexi';
```

---

## Creating a Terminal Instance

The default exported terminal can be used immediately:

```ts
import terminal from '@nasriya/zexi';

await terminal.info('Server started.');
```

When an application requires different logging policies for different parts of the application, additional terminal instances can be created with `with()`:

```ts
const verboseTerminal = terminal.with({
    logLevel: 'debug'
});

const productionTerminal = terminal.with({
    logLevel: 'warn'
});
```

These terminal instances have independent configuration while sharing the same underlying screen engine and event system.

This makes separate instances useful when different components of an application require different logging policies.

---

## Logging

Zexi provides structured logging through five severity levels:

```ts
await terminal.debug('Detailed diagnostic information.');

await terminal.info('Application started.');

await terminal.warn('Configuration file was not found.');

await terminal.error('Unable to connect to the database.');

await terminal.fatal('Application cannot continue.');
```

All logging methods accept any JavaScript value:

```ts
await terminal.info({
    message: 'User authenticated.',
    userId: 123,
    method: 'password'
});
```

The supplied value is rendered into Zexi's canonical representation before the log event is created.

The log operation produces a structured event containing the original value, serialized representation, and printable representation.

---

## Log Levels

Zexi supports the following log levels, ordered by severity:

```text
debug < info < warn < error < fatal
```

The terminal's `logLevel` controls which events are printed:

```ts
terminal.logLevel = 'warn';
```

With this configuration:

```ts
await terminal.debug('Debug message.');
await terminal.info('Information.');
await terminal.warn('Warning.');
await terminal.error('Error.');
await terminal.fatal('Fatal error.');
```

Only `warn`, `error`, and `fatal` messages are printed by that terminal instance.

Importantly, changing `logLevel` does **not** disable the corresponding events.

Events continue to be emitted and can still be consumed by application code. The setting only controls what the terminal instance prints.

---

## Log Metadata

Log metadata can be enabled when additional context should be displayed with terminal output:

```ts
terminal.includeMetadata = true;
```

When enabled, printed log entries include information such as their timestamp and log level.

For example:

```log
[2026-01-01T12:00:00.000Z] [INFO] Application started.
```

Metadata affects terminal presentation only. The underlying emitted log event retains its structured information independently of how the message is displayed.

---

## Log Events

One of Zexi's major features is that logging is not limited to terminal output.

Every log operation creates an immutable structured event that can be consumed by application code.

For example:

```ts
terminal.events.on('log', event => {
    console.log(event);
});
```

Individual log levels can also be observed:

```ts
terminal.events.on('log.error', event => {
    // Send the error event to a monitoring service.
});
```

This makes it possible to integrate Zexi with external logging and monitoring infrastructure.

For example, an application can forward Zexi events to:

* Monitoring platforms.
* Centralized logging systems.
* Log files.
* Remote observability services.
* Application-specific telemetry systems.

The terminal's human-readable output and the application's structured logging pipeline can therefore coexist without requiring the application to parse terminal output.

### Event Ordering

For a log operation, Zexi emits the level-specific event first and then the general `log` event.

Both emissions reference the same immutable event object.

```ts
terminal.events.on('log.info', event => {
    // Level-specific event.
});

terminal.events.on('log', event => {
    // General log event.
});
```

### One-Time Listeners

Listeners can also be registered for a single invocation:

```ts
terminal.events.once('clear', event => {
    console.log('Terminal was cleared.');
});
```

Both `on()` and `once()` return an unsubscribe function:

```ts
const unsubscribe = terminal.events.on('log', event => {
    // Handle event.
});

unsubscribe();
```

---

## Dynamic Terminal Entries

Logging is appropriate for messages that remain part of the terminal history.

Some applications, however, need output that changes over time.

Zexi provides dynamic terminal entries for this purpose.

```ts
const entry = await terminal.createEntry({
    value: 'Loading...'
});
```

The entry can then be updated:

```ts
entry.update('Loading... 50%');
```

And eventually finalized:

```ts
entry.update('Loading complete.');
```

Dynamic entries are useful for:

* Progress indicators.
* Download progress.
* Installation status.
* Server status.
* Counters.
* Long-running operations.
* Live application state.

### Template-Based Entries

Entries can also use templates:

```ts
const entry = await terminal.createEntry({
    template: 'Progress: ${value}%',
    params: {
        value: 0
    }
});
```

The parameters can then be updated independently:

```ts
entry.updateParams({
    value: 50
});
```

This allows an application to maintain a persistent terminal region while changing only the underlying data.

### Optional Logging

Dynamic entries can optionally emit log events:

```ts
const entry = await terminal.createEntry(
    {
        value: 'Server started.'
    },
    {
        log: true,
        level: 'info'
    }
);
```

This separates dynamic screen output from structured logging while still allowing applications to opt into logging when appropriate.

---

## Interactive Prompts

Zexi provides interactive prompts through `terminal.prompt()`.

```ts
const name = await terminal.prompt({
    message: 'Name: '
});

if (name !== null) {
    await terminal.info(`Hello, ${name}!`);
}
```

The returned value is either:

* A string containing the submitted input.
* `null` when the prompt is cancelled or times out.

An empty string is a valid submitted value:

```ts
const value = await terminal.prompt({
    message: 'Value: '
});

if (value === null) {
    await terminal.info('Prompt cancelled.');
} else if (value === '') {
    await terminal.info('An empty value was submitted.');
} else {
    await terminal.info(`Value: ${value}`);
}
```

---

## Password Input

Prompt input can be configured for different privacy modes.

### Visible Input

```ts
const username = await terminal.prompt({
    message: 'Username: ',
    privacy: 'visible'
});
```

### Password Input

```ts
const password = await terminal.prompt({
    message: 'Password: ',
    privacy: 'password'
});
```

With password privacy, each entered character is displayed as `*`.

### Hidden Input

```ts
const secret = await terminal.prompt({
    message: 'Secret: ',
    privacy: 'hidden'
});
```

The actual returned value is unaffected by the privacy mode.

---

## Input Validation

Prompt input can be validated before it is accepted.

```ts
const port = await terminal.prompt({
    message: 'Port: ',
    onCustomValidation: (value, reject) => {
        const number = Number(value);

        if (!Number.isInteger(number) || number < 0 || number > 65535) {
            reject('Please enter a valid port between 0 and 65535.');
        }
    }
});
```

When validation fails, Zexi clears the current input and displays the validation message before allowing the user to try again.

Validation callbacks can also be asynchronous:

```ts
const username = await terminal.prompt({
    message: 'Username: ',
    onCustomValidation: async (value, reject) => {
        if (value.length < 3) {
            reject('Username must contain at least 3 characters.');
            return;
        }

        const available = await checkUsernameAvailability(value);

        if (!available) {
            reject('That username is already taken.');
        }
    }
});
```

While asynchronous validation is running, further input is temporarily disabled.

---

## Confirmation Prompts

Applications can request explicit confirmation using `confirm()`:

```ts
const confirmed = await terminal.confirm(
    'Continue with the operation?'
);

if (confirmed === null) {
    return;
}

if (confirmed) {
    await performOperation();
}
```

By default, the confirmation uses:

```text
Continue with the operation? [y/N]:
```

A positive default can be selected:

```ts
const confirmed = await terminal.confirm(
    'Continue with the installation?',
    {
        default: true
    }
);
```

This produces:

```text
Continue with the installation? [Y/n]:
```

Pressing Enter accepts the default action.

The result can be:

* `true` — the action was accepted.
* `false` — the action was rejected.
* `null` — the confirmation was cancelled or timed out.

---

## Timeouts and Cancellation

Interactive operations can optionally expire after a period of inactivity.

```ts
const value = await terminal.prompt({
    message: 'Enter your name: ',
    timeoutAfter: 30_000
});
```

When the timeout expires, the prompt resolves with `null`.

The timeout represents inactivity rather than a fixed maximum duration. User input resets the timeout.

Interactive operations can also be cancelled with `Ctrl+C`.

For prompts, the `Escape` key can be configured independently:

```ts
const value = await terminal.prompt({
    message: 'Enter a value: ',
    escapeBehavior: 'reset'
});
```

Supported behaviors are:

* `cancel` — cancel the prompt.
* `reset` — clear the current input and continue.
* `ignore` — ignore the Escape key.

---

## Clearing the Terminal

The terminal can be cleared through the high-level `clear()` API:

```ts
await terminal.clear();
```

The operation is queued through Zexi's terminal task system rather than directly manipulating the screen immediately.

The returned promise resolves after the screen has been cleared and the corresponding `clear` event has been emitted and processed.

Applications that need to wait for the operation can therefore use:

```ts
await terminal.clear();

await terminal.info('The terminal has been cleared.');
```

The clear operation also emits a `clear` event:

```ts
terminal.events.on('clear', event => {
    console.log('Terminal cleared:', event);
});
```

---

## Creating Isolated Terminal Instances

The default terminal instance is suitable for most applications.

Applications that need separate terminal configurations can create additional instances:

```ts
const applicationTerminal = terminal.with({
    logLevel: 'info'
});

const debugTerminal = terminal.with({
    logLevel: 'debug',
    includeMetadata: true
});
```

Each instance maintains its own:

* `logLevel`.
* `includeMetadata`.

The instances nevertheless share the underlying screen engine and event system.

This allows different parts of an application to have different output policies without creating independent terminal environments.

---

## Events

Zexi's event system is shared across terminal instances.

A listener registered through one terminal instance can receive events emitted through another:

```ts
const terminalA = terminal.with();
const terminalB = terminal.with();

terminalA.events.on('log', event => {
    console.log('Received:', event);
});

await terminalB.info('Hello from terminal B.');
```

This architecture allows an application to centralize logging and monitoring while allowing individual components to maintain their own terminal configuration.

### Event Names

The terminal exposes the names of events that currently have registered listeners:

```ts
console.log(terminal.events.eventNames);
```

This list represents currently registered events rather than every event supported by Zexi.

---

## Creating CLI Applications

Zexi provides a dedicated CLI API for building command-line applications. The entry point is `zexi.cli`, which provides factory methods for creating both CLI applications and commands.

### Creating an Application

Use `zexi.cli.createApp()` to create the root application:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);
```

`createApp()` returns a `ZexiApp` instance. `ZexiApp` extends `ZexiStaticCommand`, so the application itself behaves as the root static command of the CLI command tree.

The application is responsible for:

* Defining the root CLI name and description
* Registering top-level commands
* Defining global options
* Registering application-level middleware and handlers
* Defining a root action
* Parsing and executing the current process arguments

For example:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

app.onRun(() => {
    zexi.terminal.info('Starting application...');
});
```

The application can also have a root action:

```ts
const app = zexi.cli.createApp('my-cli');

app.action(() => {
    zexi.terminal.info('Running my CLI...');
});
```

The root action is executed when the application itself is the selected command.

### Registering Commands

Because `ZexiApp` extends `ZexiStaticCommand`, commands can be registered directly on the application using `.command()`.

Commands can be created through `zexi.cli.createCommand()`:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

const build = zexi.cli
    .createCommand('build')
    .description('Build the project')
    .action(() => {
        zexi.terminal.info('Building project...');
    });

app.command(build);
```

The fluent API also makes it possible to construct and register a command in one expression:

```ts
app.command(
    zexi.cli
        .createCommand('build')
        .description('Build the project')
        .action(() => {
            zexi.terminal.info('Building project...');
        })
);
```

Multiple commands can be registered as well:

```ts
const build = zexi.cli
    .createCommand('build')
    .description('Build the project')
    .action(() => {
        zexi.terminal.info('Building...');
    });

const serve = zexi.cli
    .createCommand('serve')
    .description('Start the development server')
    .action(() => {
        zexi.terminal.info('Starting server...');
    });

app.command([build, serve]);
```

### Static Commands

Commands created by default are static commands:

```ts
const build = zexi.cli.createCommand('build');
```

A static command can contain nested commands, making it suitable for building hierarchical CLI interfaces.

For example:

```ts
const packages = zexi.cli
    .createCommand('packages')
    .description('Manage packages');

const install = zexi.cli
    .createCommand('install')
    .description('Install packages')
    .action(() => {
        zexi.terminal.info('Installing packages...');
    });

packages.command(install);
app.command(packages);
```

This produces a command hierarchy equivalent to:

```text
my-cli
└── packages
    └── install
```

Static commands can also define descriptions, aliases, options, `onSeen()` handlers, middleware, and an action.

For example:

```ts
const build = zexi.cli
    .createCommand('build')
    .description('Build the project')
    .aliases(['b'])
    .option({
        name: 'production',
        abbrev: 'p',
        dataType: 'boolean',
        defaultValue: false
    })
    .action(ctx => {
        const production = ctx.options.get('production');

        zexi.terminal.info(
            production
                ? 'Building for production...'
                : 'Building...'
        );
    });

app.command(build);
```

Static commands are useful when the command structure is known when the application is configured.

### Dynamic Commands

Zexi also supports dynamic commands. A dynamic command is created by explicitly passing `"dynamic"` as the command mode:

```ts
const build = zexi.cli.createCommand(
    'build',
    'dynamic'
);
```

Unlike static commands, dynamic commands **cannot contain subcommands**. Instead, they represent executable command endpoints that handle their own arguments and options.

For example:

```ts
const build = zexi.cli
    .createCommand('build', 'dynamic')
    .description('Build the project')
    .option({
        name: 'production',
        abbrev: 'p',
        dataType: 'boolean',
        defaultValue: false
    })
    .action(ctx => {
        const production = ctx.options.get('production');

        zexi.terminal.info(
            production
                ? 'Building for production...'
                : 'Building...'
        );
    });

app.command(build);
```

Dynamic commands are useful when a command should terminate the command hierarchy and execute an action directly.

### Delegator Commands

Zexi also supports delegator commands. A delegator command is created using the dynamic command mode together with another `ZexiApp` instance:

```ts
const delegatedApp = zexi.cli.createApp(
    'packages',
    'Package management commands'
);

const install = zexi.cli
    .createCommand('install')
    .description('Install packages')
    .action(() => {
        zexi.terminal.info('Installing packages...');
    });

delegatedApp.command(install);

const packages = zexi.cli.createCommand(
    'packages',
    'dynamic',
    delegatedApp
);

app.command(packages);
```

The delegator command connects one application's static command tree to another application. This allows command trees to be defined and maintained independently while still being exposed through another CLI application.

### Command Configuration

Both static and dynamic commands support the common fluent configuration API:

```ts
const command = zexi.cli
    .createCommand('deploy')
    .description('Deploy the application')
    .aliases(['d'])
    .option({
        name: 'environment',
        abbrev: 'e',
        dataType: 'string'
    })
    .onSeen(ctx => {
        zexi.terminal.debug(
            `Executing ${ctx.command.name}`
        );
    })
    .use((ctx, terminate) => {
        if (!ctx.options.get('environment')) {
            terminate({
                ok: false,
                reason: 'user_error',
                message: 'Environment is required.'
            });
        }
    })
    .action(ctx => {
        const environment = ctx.options.get('environment');

        zexi.terminal.info(
            `Deploying to ${environment}...`
        );
    });
```

The command lifecycle consists of several stages. When a command is encountered during command resolution, its `onSeen()` handlers are executed. Middleware then runs before the command action or delegation. Middleware can terminate execution when validation, authorization, or other prerequisites fail. If execution continues and the command is the selected endpoint, its action is executed.

### Application Handlers

Applications provide `onRun()` for application-level behavior:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

app.onRun(() => {
    zexi.terminal.info('Initializing CLI...');
});
```

The application handler runs whenever the root application command is encountered, including when a nested command is ultimately executed.

This makes `onRun()` suitable for application-wide initialization such as:

* Loading configuration
* Initializing shared resources
* Startup logging
* Enabling global behavior
* Preparing application-wide state

`onRun()` does not replace the root command's action. If you need an action for the application itself, use `.action()`.

For example:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

app.onRun(() => {
        loadConfiguration();
    })
    .action(() => {
        zexi.terminal.info('Running CLI...');
    });
```

### Running the Application

Once the application and its command tree have been configured, call `app.run()`:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

const build = zexi.cli
    .createCommand('build')
    .description('Build the project')
    .action(() => {
        zexi.terminal.info('Building project...');
    });

app.command(build);

const result = await app.run();
```

`run()` executes the application using the current process arguments.

During execution, Zexi handles:

1. Command resolution
2. Option parsing
3. Application and command handlers
4. Middleware execution
5. Command actions
6. Delegation when applicable

The returned promise resolves to the value produced by the command or action that was ultimately executed.

For example:

```ts
const app = zexi.cli.createApp('my-cli');

app.action(() => {
    return {
        success: true
    };
});

const result = await app.run();

console.log(result);
```

The result is therefore not limited to terminal output. A command action can return arbitrary application data, which becomes the result of the CLI execution.

### A Complete CLI Example

The following example combines an application, nested static commands, options, middleware, and dynamic commands:

```ts
const app = zexi.cli.createApp(
    'my-cli',
    'My awesome CLI tool'
);

app.onRun(() => {
    zexi.terminal.debug('Initializing CLI...');
});

const packages = zexi.cli
    .createCommand('packages')
    .description('Manage packages');

const install = zexi.cli
    .createCommand('install', 'dynamic')
    .description('Install packages')
    .option({
        name: 'production',
        abbrev: 'p',
        dataType: 'boolean',
        defaultValue: false
    })
    .use((ctx, terminate) => {
        if (!ctx.options.get('production')) {
            terminate({
                ok: false,
                reason: 'user_error',
                message: 'Production mode is required.'
            });
        }
    })
    .action(() => {
        zexi.terminal.info('Installing production packages...');
    });

packages.command(install);
app.command(packages);

await app.run();
```

The resulting structure is conceptually:

```text
my-cli
└── packages
    └── install
```

Here, `my-cli` is the root `ZexiApp`, `packages` is a static command that provides the command hierarchy, and `install` is a dynamic command that acts as the executable endpoint.

This architecture allows Zexi CLI applications to be composed from reusable command definitions while keeping command hierarchy, middleware, option handling, and execution behavior explicit.

---

## License

Zexi is licensed under the **Nasriya Personal & Commercial License (NPCL), version 2.0**.

The NPCL allows personal use under its applicable terms and requires a paid commercial license for commercial use.

See the complete license text in the repository:

[NPCL License](https://github.com/nasriyasoftware/licenses/blob/main/NPCL/v2/LICENSE.md)

For commercial licensing inquiries, contact:

**Email:** [contact@nasriya.net](mailto:contact@nasriya.net)