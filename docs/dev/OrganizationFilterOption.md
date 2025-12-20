# OrganizationFilterOption

## Overview
The `OrganizationFilterOption` class represents an option for filtering organizations, including an ID and a name. This is used in various contexts, such as dropdowns in log filters.

## Key Responsibilities
- **ID**: The unique identifier for the organization.
- **Name**: The name of the organization.

## Code Snippet
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationFilterOption {
    private String id;
    private String name;
}
```

## Dependencies
None.