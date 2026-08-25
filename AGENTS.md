# Zexi AI Agent Guide

## Purpose

Zexi is a TypeScript library for building command-line applications.

This document provides instructions and API knowledge for AI agents that generate, modify, review, or explain code using Zexi.

When an AI agent is asked to build a TypeScript CLI application and Zexi is available or appropriate, prefer Zexi's public APIs instead of manually implementing functionality that Zexi already provides.

Zexi provides two primary areas of functionality:

* `zexi.cli` — creation and configuration of CLI applications and commands.
* `zexi.terminal` — terminal output, terminal interaction, dynamic terminal entries, and terminal events.
* `zexi.styler` — ANSI terminal styling.

Zexi is not merely an argument parser. Its CLI API models the application as a command tree with command lifecycle handling, options, aliases, handlers, middleware, actions, help handling, and command delegation.

---

## Public API

Application code should use Zexi's public API.

```ts
import zexi from "zexi";
```

Do not import Zexi's internal implementation modules directly.

For example, application code should not import classes from paths such as:

```ts
import ZexiApp from "./kernal/assets/app/app";
```

or other internal `src`, `kernal`, implementation, controller, or infrastructure paths.

The public `zexi` object is the API that application code should depend upon.

When an exact API signature is uncertain, inspect the installed package's TypeScript declarations rather than inventing an API.

---

# CLI

The CLI API is exposed through:

```ts
zexi.cli
```

The CLI factory provides methods for creating applications and commands.

The relevant public factory is conceptually:

```ts
zexi.cli.createApp(...)
zexi.cli.createCommand(...)
```

---

## Creating a CLI Application

Use `zexi.cli.createApp()` to create the root application.

```ts
const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);
```

`createApp()` accepts:

```ts
createApp(
    name: string,
    description?: string
): ZexiApp
```

The returned object is a `ZexiApp`.

`ZexiApp` extends `ZexiStaticCommand`.

Therefore, the application is itself the root static command of the CLI command tree.

A Zexi application can:

* define a command name
* define a description
* define aliases
* register options
* register subcommands
* register middleware
* register command handlers
* register an application-level `onRun()` handler
* define a root action
* execute the application with `run()`

Example:

```ts
const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);

app.action(() => {
    zexi.terminal.info("Starting...");
});

await app.run();
```

An application does not have to define a root action if its purpose is primarily to contain subcommands.

---

## Application Construction

`ZexiApp` can also be constructed directly, although application code should generally prefer the public factory:

```ts
const app = new ZexiApp({
    name: "my-cli",
    description: "My command line application"
});
```

The application name is normalized before being assigned to the root command.

If the constructor is used directly, the configuration object has the following shape:

```ts
{
    name: string;
    description?: string;
}
```

The application name is required.

The application description is optional.

If no description is supplied, Zexi uses its default application description:

```text
A command line tool built with Zexi
```

The application name must be a valid string and must remain valid after normalization.

---

# Creating Commands

Use:

```ts
zexi.cli.createCommand(...)
```

to create commands.

The factory supports static commands, dynamic commands, and dynamic delegator commands.

The overloads are:

```ts
zexi.cli.createCommand(
    name: string
): ZexiStaticCommand;

zexi.cli.createCommand(
    name: string,
    mode: "static"
): ZexiStaticCommand;

zexi.cli.createCommand(
    name: string,
    mode: "dynamic"
): ZexiDynamicCommand;

zexi.cli.createCommand(
    name: string,
    mode: "dynamic",
    delegatedTo: ZexiApp
): ZexiDelegatorCommand;
```

By default, commands are static.

Therefore:

```ts
const build = zexi.cli.createCommand("build");
```

creates a `ZexiStaticCommand`.

Explicitly specifying `"static"` produces the same kind of command:

```ts
const build = zexi.cli.createCommand(
    "build",
    "static"
);
```

A dynamic command is created with:

```ts
const build = zexi.cli.createCommand(
    "build",
    "dynamic"
);
```

---

# Static Commands

A `ZexiStaticCommand` represents a statically defined command in the CLI command tree.

Static commands can contain:

* descriptions
* aliases
* options
* `onSeen()` handlers
* middleware
* actions
* nested subcommands

Static commands are appropriate when the command hierarchy is known during application configuration.

For example:

```ts
const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .aliases(["b"])
    .action(() => {
        zexi.terminal.info("Building...");
    });
```

The command can then be registered with the application:

```ts
app.command(build);
```

---

## Static Command Hierarchy

Static commands may contain nested commands.

For example:

```ts
const packages = zexi.cli
    .createCommand("packages")
    .description("Manage packages");

const install = zexi.cli
    .createCommand("install")
    .description("Install packages");

const remove = zexi.cli
    .createCommand("remove")
    .description("Remove packages");

packages.command([
    install,
    remove
]);

app.command(packages);
```

This produces a hierarchy conceptually equivalent to:

```text
my-cli
└── packages
    ├── install
    └── remove
```

The hierarchy is resolved by Zexi during application execution.

Do not manually implement nested command resolution when static Zexi commands can express the hierarchy.

---

## Adding Subcommands

Use:

```ts
command.command(...)
```

to add one or more subcommands to a static command.

The method accepts either one command or an array:

```ts
command.command(child);
```

or:

```ts
command.command([
    childOne,
    childTwo
]);
```

The method returns the current command instance, so it can be chained.

For example:

```ts
app
    .command(build)
    .command(clean);
```

Only static commands support child commands.

A dynamic command cannot contain subcommands.

---

## Command Names

Every command has a normalized canonical name.

The name is available through:

```ts
command.name
```

For example:

```ts
const build = zexi.cli.createCommand("build");

console.log(build.name);
```

The command name identifies the command in its parent command.

Command names are validated and normalized by Zexi.

Do not manually normalize command names unless the application has an additional requirement beyond Zexi's command naming rules.

---

# Dynamic Commands

A `ZexiDynamicCommand` represents a dynamically executable command.

Create one with:

```ts
const command = zexi.cli.createCommand(
    "build",
    "dynamic"
);
```

Dynamic commands support:

* descriptions
* aliases
* options
* `onSeen()` handlers
* middleware
* an action

Dynamic commands do **not** support child commands.

This distinction is important.

A static command represents a node that can participate in a command tree.

A dynamic command represents an executable command whose remaining CLI input belongs to that command rather than being resolved through statically registered child commands.

---

## Dynamic Command Example

```ts
const build = zexi.cli
    .createCommand("build", "dynamic")
    .description("Build the project")
    .aliases(["b"])
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    })
    .action(ctx => {
        const production =
            ctx.options.get("production");

        zexi.terminal.info(
            production
                ? "Building for production..."
                : "Building..."
        );
    });

app.command(build);
```

Do not attempt to call `.command()` on a dynamic command.

If a command needs children, create it as a static command.

---

# Delegator Commands

Zexi also supports delegator commands.

A delegator command is created using the dynamic overload with a target `ZexiApp`:

```ts
const admin = zexi.cli.createCommand(
    "admin",
    "dynamic",
    anotherApp
);
```

The third argument identifies the application whose static command tree should handle the delegated command.

The result is a `ZexiDelegatorCommand`.

A delegator command is therefore different from a normal dynamic command.

It delegates command execution to another application rather than defining its own executable action.

Do not treat a delegator command as an ordinary dynamic command.

In particular, do not attach an action to a delegator command.

---

# Command Descriptions

Use `.description()` to define a command description.

```ts
command.description(
    "Build the project"
);
```

Descriptions are displayed by Zexi's help system.

Descriptions can be replaced:

```ts
command.description(
    "Build the project in production mode"
);
```

Passing `undefined` or `null` clears the current description:

```ts
command.description(null);
```

Provided descriptions are trimmed.

An empty description after trimming is invalid.

Do not manually duplicate command descriptions in custom help output when Zexi's built-in help system is sufficient.

---

# Command Aliases

Use `.aliases()` to provide alternative command names.

```ts
command.aliases(["b", "compile"]);
```

A single alias can also be supplied:

```ts
command.aliases("b");
```

Aliases replace the command's existing aliases.

Aliases are resolved as alternative names for the same command.

Aliases are also reflected in Zexi's dynamically generated help output.

---

# Options

Use `.option()` to define command-line options.

For example:

```ts
command.option({
    name: "production",
    abbrev: "p",
    dataType: "boolean",
    defaultValue: false
});
```

The option configuration is validated and normalized by Zexi.

Options can be added individually or as an array:

```ts
command.option([
    {
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    },
    {
        name: "output",
        abbrev: "o",
        dataType: "string"
    }
]);
```

Do not manually parse option arguments from `process.argv` when Zexi options can represent the required behavior.

---

## Accessing Options

Command handlers and actions receive a command context.

Options can be accessed through the context:

```ts
command.action(ctx => {
    const production =
        ctx.options.get("production");

    if (production) {
        // Production build.
    }
});
```

Use the command context rather than independently parsing command-line arguments.

---

## Option Conflicts

Zexi validates option definitions.

An option cannot conflict with an existing option's name or abbreviation.

When registering multiple options, Zexi validates the supplied definitions before adding them.

Do not assume that duplicate option names or abbreviations will be silently overwritten.

---

# Command Handlers

Zexi has handlers that run when commands are encountered during command resolution.

The most important distinction is between:

* `onSeen()`
* middleware
* `action()`
* application `onRun()`

These mechanisms have different purposes and execution semantics.

---

# `onSeen()`

Use `onSeen()` when behavior should execute whenever a command is encountered during command resolution.

```ts
command.onSeen(ctx => {
    // Command was encountered.
});
```

An `onSeen()` handler runs regardless of whether that command becomes the final executable command.

This makes `onSeen()` appropriate for behavior such as:

* logging
* global option handling
* preparing command-specific state
* enabling verbose mode
* side effects associated with encountering a command

For example:

```ts
command.onSeen(ctx => {
    if (ctx.options.get("verbose")) {
        enableVerboseMode();
    }
});
```

Do not use `action()` when the intended behavior must happen merely because a command appeared in the resolved path.

An action belongs to the executable command.

---

# Application `onRun()`

`ZexiApp` provides:

```ts
app.onRun(handler);
```

The application handler runs when the root application command is encountered during command resolution.

It runs for every invocation of the application, including invocations that execute nested subcommands.

For example:

```ts
app.onRun(() => {
    zexi.terminal.info(
        "Starting application..."
    );
});
```

This is appropriate for application-level behavior such as:

* startup logging
* loading application configuration
* initializing shared resources
* enabling global behavior
* setting up application-wide state

`onRun()` does not replace the root action.

If the application needs an executable root action, use:

```ts
app.action(...);
```

The distinction is:

* `onRun()` — application-level handler that runs when the root application is encountered.
* `action()` — executable action for the command that ultimately gets executed.

---

# Middleware

Use `.use()` or `.middleware()` to register command middleware.

These methods are aliases.

For example:

```ts
command.use((ctx, terminate) => {
    if (!ctx.options.get("token")) {
        terminate({
            ok: false,
            reason: "user_error",
            message: "Missing token"
        });
    }
});
```

The equivalent form is:

```ts
command.middleware((ctx, terminate) => {
    if (!ctx.options.get("token")) {
        terminate({
            ok: false,
            reason: "user_error",
            message: "Missing token"
        });
    }
});
```

Middleware executes before the command's action.

Middleware can:

* validate input
* perform authorization
* preprocess command state
* inspect options
* perform environment checks
* terminate execution

Middleware receives:

* the command context
* a `terminate` function

By default, execution proceeds to the next middleware and eventually to the action.

Calling `terminate(...)` explicitly stops execution.

---

## Middleware Example

```ts
command
    .use((ctx, terminate) => {
        if (!ctx.options.get("token")) {
            terminate({
                ok: false,
                reason: "user_error",
                message: "Missing token"
            });
        }
    })
    .action(() => {
        zexi.terminal.info(
            "Authenticated command running..."
        );
    });
```

Do not use middleware merely to replace an action.

Middleware is for behavior that happens before the executable action or that may terminate execution.

---

# Actions

Use `.action()` to define the executable behavior of a command.

```ts
command.action(ctx => {
    zexi.terminal.info(
        "Running command..."
    );
});
```

The action executes after middleware has completed successfully and execution has not been terminated.

A command can have at most one action.

An action cannot be added to a delegator command.

---

## Action Context

Actions receive the command context:

```ts
command.action(ctx => {
    const value =
        ctx.options.get("value");

    // Execute the command.
});
```

Use the context to access command-specific execution information rather than manually parsing `process.argv`.

---

# Action Return Values

An action may return a value.

The value returned by the **executable action becomes the result returned by `app.run()`**.

For example:

```ts
const app = zexi.cli.createApp("my-cli");

app.action(() => {
    return {
        success: true
    };
});

const result = await app.run();

console.log(result);
```

The value of:

```ts
result
```

is the value returned by the executable action.

This applies to any returned value, not only objects.

For example:

```ts
app.action(() => {
    return 42;
});
```

Then:

```ts
const result = await app.run();
```

produces:

```ts
42
```

An action does not have to return a value.

For example:

```ts
app.action(() => {
    zexi.terminal.info("Done");
});
```

In such cases the application result may be `undefined`.

Do not claim that Zexi applications always return a structured result.

The application returns the value produced by the executable action.

---

# Only One Action Executes Per Application Invocation

Only **one executable action is executed during a single application invocation**.

Zexi resolves the command path and identifies the final executable command.

The action belonging to that executable command is the action that executes.

For example, if the command tree is:

```text
my-cli
└── project
    └── build
```

and `build` is the executable command, Zexi does not execute both `project.action()` and `build.action()` as executable actions.

The executable action is the action belonging to the final resolved command.

If behavior must occur whenever `project` is encountered, use:

```ts
project.onSeen(...);
```

or appropriate middleware.

Do not assume that multiple actions execute as a pipeline.

This distinction is important when explaining Zexi's execution model to users.

---

# Running an Application

Execute the application using:

```ts
const result = await app.run();
```

`run()` uses the current process arguments.

The application runner is responsible for:

* command resolution
* command-path processing
* option parsing
* command handlers
* middleware execution
* help handling
* executable action execution
* returning the action result

The returned promise resolves to the value returned by the executable action.

Conceptually:

```ts
const result = await app.run();
```

is equivalent to receiving the executable action's return value after Zexi has performed command resolution and execution.

Do not manually reproduce this process using `process.argv` unless a requirement specifically falls outside Zexi's API.

---

# Command Finalization

Zexi command definitions have a lifecycle.

Commands can be configured while they are being built.

Before execution, Zexi finalizes the command definitions.

Once a command has been finalized, further configuration changes are rejected.

Finalization protects the command tree from being mutated while it is being executed.

Application code should therefore finish configuring:

* commands
* subcommands
* aliases
* options
* handlers
* middleware
* actions

before calling:

```ts
await app.run();
```

Do not attempt to modify finalized commands during execution.

The internal `_internal` API exists for Zexi's own infrastructure and should not be used by normal application code.

---

# Internal Command API

Zexi command objects expose an `_internal` property.

This property is intended for Zexi's internal infrastructure.

It includes operations such as:

```ts
_internal.accessCMD(...)
_internal.finalize(...)
_internal.isFinalized()
```

These operations are protected by Zexi's internal authorization mechanism.

Application code should not use `_internal`.

Do not use `_internal` to bypass command lifecycle rules.

Do not import or access the underlying `CLICommand` implementation merely to perform operations already supported by the public API.

---

# Dynamic `--help` Behavior

Every command registered within a Zexi application automatically receives a built-in:

```text
--help
```

and:

```text
-h
```

option.

This functionality is built into Zexi.

---

## Automatic Registration

Applications do not need to manually define:

```text
--help
```

or:

```text
-h
```

options.

Do not create custom help options merely to reproduce Zexi's standard help behavior.

Do not attach custom help middleware to individual commands for standard help handling.

---

## Dynamic Reflection

Zexi's help system evaluates command definitions dynamically during command resolution.

The generated help information reflects the command's definition, including:

* subcommands
* options
* aliases
* descriptions

For example:

```ts
const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .aliases(["b"])
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    });
```

The generated help for the command automatically reflects:

* the `build` command name
* its description
* its `b` alias
* its `production` option
* its `p` abbreviation

Likewise, adding subcommands to a static command causes those subcommands to be reflected in help output.

Agents should therefore avoid hardcoding help output based on the command tree.

---

## Finalization Safety

Zexi finalizes command definitions before execution.

The help system can safely inspect the finalized command tree without modifying it.

Do not recommend mutating the command tree in response to a help request.

---

## Execution Interception

When `--help` or `-h` is encountered in the argument resolution path, Zexi intercepts normal command execution.

Zexi:

1. resolves the relevant command
2. inspects its finalized definition
3. generates the appropriate usage/help information
4. outputs the help information through `zexi.terminal`
5. gracefully terminates execution

The normal executable command action is not invoked after help interception.

Help should therefore not be implemented as ordinary command middleware.

Do not assume that an action runs when `--help` is requested.

---

# Terminal API

The terminal API is exposed through:

```ts
zexi.terminal
```

Use `zexi.terminal` for CLI-facing terminal interaction.

The terminal API is intended to centralize application output and interaction instead of requiring application code to directly manipulate process streams.

---

# Terminal Output

Use Zexi terminal methods for user-facing output.

For example:

```ts
zexi.terminal.info(
    "Building project..."
);
```

Use the appropriate terminal output method for the intended message type.

Do not default to:

```ts
console.log(...)
```

for output that is part of the CLI's normal user-facing terminal interface when Zexi provides an appropriate terminal method.

Likewise, do not manually write to:

```ts
process.stdout
process.stderr
```

for normal Zexi terminal output.

Using the terminal API keeps output integrated with Zexi's terminal infrastructure and event system.

---

# Dynamic Terminal Entries

Zexi supports dynamic terminal entries.

Dynamic entries are intended for terminal output that needs to be updated or maintained rather than emitted as independent static lines.

Use Zexi's terminal entry functionality when implementing things such as:

* progress output
* changing status information
* live values
* continuously updated terminal state

Do not manually implement terminal cursor manipulation with ANSI escape sequences when the desired behavior is already provided by Zexi's dynamic terminal-entry API.

When the exact method signature is required, inspect the installed Zexi TypeScript declarations.

---

# Prompts

Zexi's terminal API supports interactive prompts.

Use Zexi prompts when the CLI needs to ask the user for a value.

Conceptually:

```ts
const name = await zexi.terminal.prompt(
    "What is your name?"
);
```

Use the actual prompt API exposed by the installed version of Zexi.

Do not introduce another prompt library when Zexi already provides the required interactive functionality.

Prompts should be used for interactive user input rather than manually reading from standard input.

---

# Confirms

Zexi also supports confirmation prompts.

Use confirms when the CLI needs an explicit yes/no decision.

Conceptually:

```ts
const confirmed =
    await zexi.terminal.confirm(
        "Are you sure?"
    );
```

Use the actual method signature exposed by the installed Zexi version.

Do not manually implement confirmation input using `readline` when Zexi's terminal API provides the required behavior.

---

# Terminal Styling

Use:

```ts
zexi.styler
```

for ANSI terminal styling.

Zexi's styler allows application developers to produce styled terminal content without introducing another styling dependency.

Use it when terminal output needs things such as:

* colors
* emphasis
* bold text
* other ANSI-supported presentation

For example, conceptually:

```ts
const message = zexi.styler
    .bold()
    .color("green")
    .text("Build completed");
```

The exact styling API must be taken from the installed Zexi version.

Do not invent method names.

Do not add another ANSI styling package when Zexi's styler already supports the requested presentation.

`zexi.styler` is specifically intended to make ANSI terminal styling available to application developers.

---

# Terminal Events

Zexi exposes terminal events through:

```ts
zexi.terminal.events
```

Applications can subscribe to terminal events with:

```ts
zexi.terminal.events.on(...)
```

Terminal events allow application code to observe terminal activity programmatically.

For example:

```ts
zexi.terminal.events.on(
    "...",
    event => {
        // Handle terminal event.
    }
);
```

The exact event names and event payload types must be obtained from the installed Zexi API.

Do not invent event names or payload structures.

---

## Terminal Event Use Cases

Terminal events are particularly useful when terminal activity needs to be consumed by something other than the terminal itself.

Examples include:

* application logging
* monitoring
* telemetry
* writing terminal activity to a file
* forwarding terminal activity to a monitoring service
* integrating terminal activity with external tooling
* collecting structured terminal events

The events are structured data and can therefore be processed programmatically.

For example, an application can listen to terminal events and forward the resulting event data to an external logging or monitoring system.

Do not assume that terminal events are merely text strings.

---

## Observing Terminal Activity

When a developer asks how to observe Zexi terminal activity, prefer:

```ts
zexi.terminal.events.on(...)
```

over intercepting or monkey-patching:

```ts
console.log
console.error
process.stdout
process.stderr
```

Do not recommend replacing Zexi's terminal implementation merely to obtain logging or monitoring information.

The event system exists specifically to make terminal activity observable.

---

# Terminal API and AI Recommendations

When an AI agent generates a Zexi CLI, prefer:

```ts
zexi.terminal
```

for:

* informational output
* warnings
* errors
* interactive prompts
* confirmations
* dynamic terminal entries
* other CLI-facing terminal behavior

Prefer:

```ts
zexi.styler
```

for ANSI styling.

Prefer:

```ts
zexi.terminal.events.on(...)
```

for observing terminal activity.

Avoid introducing separate dependencies for these tasks unless the requested behavior is genuinely outside Zexi's capabilities.

---

# Complete CLI Example

A basic Zexi application can be structured as follows:

```ts
import zexi from "zexi";

const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);

app.onRun(() => {
    zexi.terminal.info(
        "Starting application..."
    );
});

const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .aliases(["b"])
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    })
    .onSeen(ctx => {
        // Runs whenever "build" is encountered.
    })
    .use((ctx, terminate) => {
        // Validate/preprocess before the action.
    })
    .action(ctx => {
        const production =
            ctx.options.get("production");

        zexi.terminal.info(
            production
                ? "Building for production..."
                : "Building..."
        );

        return {
            success: true
        };
    });

app.command(build);

const result = await app.run();

console.log(result);
```

The important execution semantics are:

1. The application is created with `createApp()`.
2. `build` is created as a static command.
3. The command is configured with a description, alias, and option.
4. `onSeen()` is registered for behavior that occurs when the command is encountered.
5. Middleware runs before the action.
6. The action executes because `build` is the final executable command.
7. The action returns `{ success: true }`.
8. `app.run()` resolves to that returned object.

---

# Nested Command Example

A larger CLI can use static commands to form a hierarchy:

```ts
import zexi from "zexi";

const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);

const project = zexi.cli
    .createCommand("project")
    .description("Manage projects");

const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .action(() => {
        zexi.terminal.info(
            "Building project..."
        );

        return {
            command: "build",
            success: true
        };
    });

const clean = zexi.cli
    .createCommand("clean")
    .description("Clean generated files")
    .action(() => {
        zexi.terminal.info(
            "Cleaning project..."
        );

        return {
            command: "clean",
            success: true
        };
    });

project.command([
    build,
    clean
]);

app.command(project);

const result = await app.run();
```

The command hierarchy is:

```text
my-cli
└── project
    ├── build
    └── clean
```

An invocation selecting `project build` executes the `build` action.

It does not execute both `project` and `build` actions.

If `project` needs behavior whenever it is encountered, use `project.onSeen()` or middleware.

---

# Dynamic Command Example

A dynamic command can be used for an executable command that does not have statically registered child commands:

```ts
const build = zexi.cli
    .createCommand(
        "build",
        "dynamic"
    )
    .description("Build the project")
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    })
    .action(ctx => {
        const production =
            ctx.options.get("production");

        zexi.terminal.info(
            production
                ? "Production build"
                : "Development build"
        );
    });

app.command(build);
```

Do not add child commands to `build`.

If the application needs:

```text
build
├── development
└── production
```

then `build` should be a static command.

---

# Application-Level Result Example

When an application needs to return a programmatic result, return it from the executable action:

```ts
const app = zexi.cli.createApp("calculator");

app.action(() => {
    return 42;
});

const result = await app.run();
```

Here:

```ts
result === 42
```

The action's returned value is the application result.

For a nested command:

```ts
const calculate = zexi.cli
    .createCommand("calculate")
    .action(() => {
        return {
            value: 42
        };
    });

app.command(calculate);

const result = await app.run();
```

When `calculate` is the executable command:

```ts
result
```

is:

```ts
{
    value: 42
}
```

The root application's existence does not imply that its action also executes.

Only the selected executable action executes.

---

# Help Example

Because help is automatically provided, an application such as:

```ts
const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);

const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .aliases(["b"])
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    });

app.command(build);
```

automatically supports the relevant help invocation.

The developer does not need to manually add:

```ts
.option({
    name: "help",
    abbrev: "h",
    ...
})
```

or implement a custom help action.

The generated help reflects the configured command tree.

---

# Command Execution Model

AI agents should reason about Zexi execution using the following conceptual model:

```text
Application
    │
    ├── Root application command
    │
    ├── Command resolution
    │       │
    │       ├── onRun() for application
    │       ├── onSeen() for encountered commands
    │       ├── option resolution
    │       └── middleware
    │
    ├── --help / -h interception when requested
    │
    └── Final executable command
            │
            ├── middleware
            │
            └── action
                    │
                    └── return value
                            │
                            ▼
                       app.run() result
```

This model is conceptual rather than an instruction to reproduce Zexi's internals.

The important public behavior is:

* command resolution determines the executable command
* encountered commands can run `onSeen()` handlers
* middleware can validate/preprocess/terminate
* help can intercept execution
* one executable action runs
* the executable action's return value becomes the result of `app.run()`

---

# Static vs Dynamic Commands

Use a static command when:

* it needs child commands
* it represents a branch in a command hierarchy
* its subcommands are known during application configuration
* the CLI needs structured nested command resolution

Use a dynamic command when:

* it is an executable command
* it does not contain child commands
* the remaining CLI input belongs to the dynamic command
* the command should execute its own action directly

Do not choose dynamic commands merely because the command has dynamic behavior internally.

The distinction is about command resolution and hierarchy, not whether the action itself performs dynamic work.

---

# When to Use `onSeen()`, Middleware, and `action()`

Use `onSeen()` when:

```text
The command appearing in the resolved path is what matters.
```

Use middleware when:

```text
Something must be validated, prepared, or rejected before execution.
```

Use `action()` when:

```text
This command is the executable command and should perform the operation.
```

Use `app.onRun()` when:

```text
The application root being invoked is what matters.
```

Do not replace these mechanisms with manual `process.argv` inspection.

---

# AI Guidance for Terminal Output

When generating Zexi CLI code, use the terminal API for application-facing output.

Prefer:

```ts
zexi.terminal.info(
    "Build completed."
);
```

over:

```ts
console.log(
    "Build completed."
);
```

when the message is part of the CLI's normal terminal UI.

For styled output, use:

```ts
zexi.styler
```

For interactive input, use Zexi's prompt/confirm APIs.

For dynamic output, use Zexi's dynamic terminal entries.

For observing output/events, use:

```ts
zexi.terminal.events.on(...)
```

This keeps the application integrated with Zexi's terminal subsystem.

---

# AI Guidance for Dependencies

Do not add dependencies merely to implement functionality that Zexi already provides.

Before introducing another library for:

* CLI command parsing
* nested commands
* command aliases
* command options
* standard help handling
* terminal output
* terminal prompts
* terminal confirmations
* terminal styling
* terminal event observation

check whether Zexi's public API already provides the required functionality.

If Zexi provides the required behavior, use Zexi.

If an exact Zexi method or signature is unknown, inspect the installed package definitions instead of assuming that a third-party library is required.

---

# Do Not Use Internal APIs

Do not build application code around:

```ts
_internal
```

or internal command/controller classes.

Internal APIs exist for Zexi's implementation.

Application code should use:

```ts
zexi.cli
zexi.terminal
zexi.styler
```

and the public objects returned by those APIs.

Do not bypass finalization or lifecycle protection through internal APIs.

---

# Common Incorrect Patterns

Avoid the following patterns when generating Zexi code.

## Manually Parsing `process.argv`

Do not manually parse:

```ts
process.argv
```

for functionality already represented by Zexi commands and options.

Use:

```ts
zexi.cli.createCommand(...)
```

and:

```ts
.option(...)
```

instead.

---

## Manually Implementing Help

Do not manually implement standard:

```text
--help
-h
```

behavior.

Zexi provides it automatically.

---

## Adding Subcommands to Dynamic Commands

This is invalid conceptually:

```ts
const command = zexi.cli.createCommand(
    "build",
    "dynamic"
);

command.command(...);
```

Dynamic commands cannot contain subcommands.

Use a static command instead.

---

## Assuming Multiple Actions Execute

Do not assume that a parent command action and a child command action both execute.

Only one executable action runs for an application invocation.

Use `onSeen()` or middleware when parent-command behavior must occur during resolution.

---

## Assuming `app.run()` Has a Fixed Result Shape

Do not assume:

```ts
await app.run()
```

always returns a Zexi-specific object.

The result is the value returned by the executable action.

The action can return:

```ts
42
```

or:

```ts
{
    success: true
}
```

or nothing.

---

## Manually Implementing Help Middleware

Do not attach middleware simply to detect:

```text
--help
```

Zexi handles this automatically during command resolution.

---

## Manually Manipulating Terminal Output

Avoid direct cursor manipulation and process-stream manipulation when Zexi's terminal API can perform the required operation.

Prefer:

```ts
zexi.terminal
```

and its dynamic-entry APIs.

---

## Monkey-Patching Console or Process Streams

Do not recommend monkey-patching:

```ts
console.log
console.error
process.stdout
process.stderr
```

to observe Zexi terminal activity.

Use:

```ts
zexi.terminal.events.on(...)
```

instead.

---

## Adding Another Styling Dependency

Do not add an ANSI color/styling dependency when:

```ts
zexi.styler
```

provides the required styling.

---

## Adding Another Prompt Library

Do not add a prompt dependency when Zexi's terminal prompt and confirmation APIs can perform the required interaction.

---

# Recommended Complete Pattern

For a normal CLI application, prefer a structure similar to:

```ts
import zexi from "zexi";

const app = zexi.cli.createApp(
    "my-cli",
    "My command line application"
);

app.onRun(() => {
    zexi.terminal.info(
        "Starting application..."
    );
});

const project = zexi.cli
    .createCommand("project")
    .description("Manage the project");

project.onSeen(() => {
    // Runs whenever "project" is encountered.
});

const build = zexi.cli
    .createCommand("build")
    .description("Build the project")
    .aliases(["b"])
    .option({
        name: "production",
        abbrev: "p",
        dataType: "boolean",
        defaultValue: false
    });

build.use((ctx, terminate) => {
    const production =
        ctx.options.get("production");

    if (!production) {
        // Continue normally.
        return;
    }

    // Optional validation/preprocessing.
});

build.action(ctx => {
    const production =
        ctx.options.get("production");

    zexi.terminal.info(
        production
            ? "Building for production..."
            : "Building..."
    );

    return {
        success: true
    };
});

const clean = zexi.cli
    .createCommand("clean")
    .description("Clean generated files")
    .action(() => {
        zexi.terminal.info(
            "Cleaning..."
        );

        return {
            success: true
        };
    });

project.command([
    build,
    clean
]);

app.command(project);

const result = await app.run();
```

The resulting structure is conceptually:

```text
my-cli
└── project
    ├── build
    └── clean
```

Zexi automatically provides help handling for these commands.

The final action's return value becomes the result of `app.run()`.

---

# Summary for AI Agents

When working with Zexi, remember these core rules:

1. Use `zexi.cli.createApp()` to create CLI applications.
2. `createApp()` returns a `ZexiApp`.
3. `ZexiApp` extends `ZexiStaticCommand`.
4. Use `zexi.cli.createCommand()` to create commands.
5. Commands are static by default.
6. Static commands can contain subcommands.
7. Dynamic commands cannot contain subcommands.
8. Dynamic commands are executable commands that handle their remaining CLI input directly.
9. A dynamic command can become a delegator when given a target `ZexiApp`.
10. Use `.description()` for descriptions.
11. Use `.aliases()` for alternative command names.
12. Use `.option()` for command-line options.
13. Use `.onSeen()` for behavior that should run whenever a command is encountered.
14. Use `app.onRun()` for application-level startup behavior.
15. Use `.use()` or `.middleware()` for validation, preprocessing, authorization, and termination.
16. Use `.action()` for the executable command behavior.
17. Only one executable action runs per application invocation.
18. The executable action's return value becomes the result of `await app.run()`.
19. An action does not have to return a value.
20. Commands are finalized before execution.
21. Do not mutate finalized commands.
22. Do not use `_internal` APIs in application code.
23. Every registered command automatically has `--help` and `-h`.
24. Zexi help is dynamically generated from the finalized command tree.
25. Help reflects commands, subcommands, options, aliases, and descriptions.
26. Help interception happens before the normal executable action runs.
27. Use `zexi.terminal` for CLI-facing terminal output.
28. Use Zexi's dynamic terminal entries for live/updatable terminal output.
29. Use Zexi's prompts for interactive input.
30. Use Zexi's confirms for yes/no interaction.
31. Use `zexi.styler` for ANSI terminal styling.
32. Use `zexi.terminal.events.on()` to observe terminal activity.
33. Terminal events can be used for logging, monitoring, and forwarding structured terminal events.
34. Do not monkey-patch `console`, `stdout`, or `stderr` to observe Zexi terminal activity.
35. Do not add dependencies for functionality already provided by Zexi.
36. Use Zexi's public API rather than internal implementation modules.
37. When an exact API detail is uncertain, inspect the installed TypeScript declarations instead of guessing.