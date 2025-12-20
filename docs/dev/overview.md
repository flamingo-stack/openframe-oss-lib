# Overview of the openframe-oss-lib Repository

## Purpose of the Repository
The `openframe-oss-lib` repository is designed to provide a comprehensive set of libraries and modules for managing agent registrations, tool installations, updates, and various data processing tasks within the OpenFrame ecosystem. It facilitates communication between different services, ensuring efficient data flow and management across the system.

## End-to-End Architecture
The architecture of the `openframe-oss-lib` repository can be visualized through the following mermaid diagrams representing the core modules and their interactions:

### Module 1 Architecture
```mermaid
flowchart TD
    A["Default Agent Registration Processor"] -->|processes| B["Agent Registration Request"]
    A -->|logs| C["Logging"]
    D["Force Client Update Response"] -->|contains| E["Force Client Update Response Item"]
    F["Client Registration Strategy"] -->|builds| G["Client Registration"]
    H["Deserialized Debezium Message"] -->|contains| I["Common Debezium Message"]
    J["Host Search Response"] -->|contains| K["Host"]
    A -->|interacts with| F
    A -->|interacts with| D
    A -->|interacts with| H
    A -->|interacts with| J
```

### Module 2 Architecture
```mermaid
flowchart TD
    A["Integrated Tool Enriched Data"] -->|contains| B["User Repository"]
    A -->|provides data to| C["Agent Info"]
    A -->|handles requests for| D["Force Tool Reinstallation Request"]
    A -->|returns organization data| E["Organization Response"]
```

### Module 3 Architecture
```mermaid
flowchart TD
    A["ToolAgentIdTransformerService"] -->|transforms agent IDs| B["OrganizationQueryFilter"]
    A -->|uses| C["CreateScriptRequest"]
    D["ReactiveApiKeyRepository"] -->|manages| E["LogDetails"]
    B -->|filters| F["OrganizationQueryFilter"]
```

### Module 4 Architecture
```mermaid
flowchart TD
    A["ToolQueryFilter"] -->|filters| B["Host"]
    B -->|manages| C["ReactiveIntegratedToolRepository"]
    C -->|provides data| D["OrganizationFilterOptions"]
    C -->|uses| E["MicrosoftClientRegistrationStrategy"]
```

### Module 5 Architecture
```mermaid
flowchart TD
    A["Script List Item"] -->|contains| B["Google Client Registration Strategy"]
    A -->|utilizes| C["Device Filter Option"]
    A -->|utilizes| D["Tag Filter Option"]
    A -->|interacts with| E["Custom Event Repository"]
    subgraph device_management["Device Management"]
        C
        D
    end
    subgraph event_processing["Event Processing"]
        E
    end
```

### Module 6 Architecture
```mermaid
flowchart TD
    A["Force Tool Installation Request"] -->|contains| B["Machine IDs"]
    A -->|contains| C["Tool Agent ID"]
    D["Force Tool Update Request"] -->|contains| E["Machine IDs"]
    D -->|contains| F["Tool Agent ID"]
    G["Query Result"] -->|contains| H["Host ID"]
    G -->|contains| I["Rows"]
    G -->|contains| J["Error"]
    G -->|contains| K["Status"]
    G -->|contains| L["Query"]
    G -->|contains| M["Executed At"]
    N["Agent List Item"] -->|contains| O["ID"]
    N -->|contains| P["Agent ID"]
    N -->|contains| Q["Hostname"]
    N -->|contains| R["Site"]
    N -->|contains| S["Client"]
```

### Module 7 Architecture
```mermaid
flowchart TD
    A["Force Tool Installation All Request"] -->|contains| B["Tool Agent ID"]
    A -->|triggers| C["Force Tool Agent Installation Response Item"]
    C -->|provides status for| D["Agent Registration Secret Request"]
    D -->|includes| E["Query Stats"]
    E -->|tracks| F["Counted Generic Query Result"]
```

### Module 8 Architecture
```mermaid
flowchart TD
    A["Organization Filter Option"] -->|used in| B["Event Query Filter"]
    C["Host Search Request"] -->|utilizes| D["Tool Agent ID Transformer"]
    E["Force Client Update Request"] -->|contains| F["Machine IDs"]
    subgraph data_layer["Data Layer"]
        A
        B
        C
        E
    end
```

### Module 9 Architecture
```mermaid
flowchart TD
    A["Base OIDC Client Registration Strategy"] -->|uses| B["SSO Config Service"]
    A -->|builds| C["Client Registration"]
    C -->|returns| D["Force Client Update Response Item"]
    E["Log Filters"] -->|filters| F["Device Filters"]
    G["Reactive OAuth Client Repository"] -->|interacts with| H["OAuth Client"]
```

### Module 10 Architecture
```mermaid
flowchart TD
    A["MachineQueryFilter"] -->|defines filters for| B["DeviceFilterOptions"]
    C["ReactiveTenantRepository"] -->|interacts with| D["Tenant"]
    E["LogEvent"] -->|logs events for| F["Device"]
    A -->|uses| B
    C -->|extends| G["ReactiveMongoRepository"]
    C -->|implements| H["BaseTenantRepository"]
```

### Module 11 Architecture
```mermaid
flowchart TD
    A["GenericQueryResult"] -->|contains| B["CursorPageInfo"]
    C["ForceToolAgentUpdateResponse"] -->|contains| D["ForceToolAgentUpdateResponseItem"]
    E["OrganizationList"] -->|contains| F["Organization"]
    G["RedirectTargetResolver"] -->|resolves| H["DefaultRedirectTargetResolver"]
    H -->|uses| I["ServerHttpRequest"]
```

### Module 12 Architecture
```mermaid
flowchart TD
    A["Agent Registration Processor"] -->|processes| B["Force Tool Agent Installation Response"]
    A -->|processes| C["Force Tool Agent Update Response Item"]
    D["Log Filter Options"] -->|filters| E["Event Filter Options"]
    A -->|uses| D
    A -->|uses| E
```

### Module 13 Architecture
```mermaid
flowchart TD
    A["FleetMdmAgentIdTransformer"] -->|transforms agent IDs| B["CommandResult"]
    A -->|manages| C["EventFilters"]
    A -->|uses| D["IntegratedToolService"]
    A -->|uses| E["ToolUrlService"]
    D -->|provides| F["IntegratedTool"]
    E -->|provides| G["ToolUrl"]
    A -->|interacts with| H["FleetMdmClient"]
    H -->|searches for| I["Host"]
```

## Core Modules Documentation
The repository consists of several core modules, each with its own documentation. Below are the references to the documentation for each module:

- **Module 1**: [Module 1 Documentation](module_1.md)
- **Module 2**: [Module 2 Documentation](module_2.md)
- **Module 3**: [Module 3 Documentation](module_3.md)
- **Module 4**: [Module 4 Documentation](module_4.md)
- **Module 5**: [Module 5 Documentation](module_5.md)
- **Module 6**: [Module 6 Documentation](module_6.md)
- **Module 7**: [Module 7 Documentation](module_7.md)
- **Module 8**: [Module 8 Documentation](module_8.md)
- **Module 9**: [Module 9 Documentation](module_9.md)
- **Module 10**: [Module 10 Documentation](module_10.md)
- **Module 11**: [Module 11 Documentation](module_11.md)
- **Module 12**: [Module 12 Documentation](module_12.md)
- **Module 13**: [Module 13 Documentation](module_13.md)

## Conclusion
The `openframe-oss-lib` repository serves as a foundational library for the OpenFrame ecosystem, providing essential functionalities for agent management, tool installations, and data processing. Each module is designed to work cohesively, ensuring a robust and efficient system architecture.