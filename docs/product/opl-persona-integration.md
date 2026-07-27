# OPL Persona Integration

OPL Persona enters OPL App as an ordinary Package contribution. App does not
special-case `opl-persona`, treat it as a standard agent, or copy its private
state.

The fixture in
`contracts/fixtures/opl-persona-app-contributions.fixture.json` is the v1
consumer contract:

- `persona.today` is an `activity_log` backed by `personal.context.v1#today`.
- `persona.proposals` is an `approval_diff` backed by
  `personal.context.v1#proposals`.
- approval remains an explicit command with confirmation metadata.

The fixture proves schema and local reference integrity. It does not claim that
the production navigation mount, installed Persona Package, or runtime adapter
is already released; those remain separate App/Shell gates.
