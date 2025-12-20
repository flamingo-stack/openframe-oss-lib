# OrganizationQueryFilter Documentation

## Overview
The `OrganizationQueryFilter` class defines the filter criteria for querying organizations in MongoDB. It is used to build queries with specific filtering options.

## Core Responsibilities
- **Filter Criteria**: Contains fields such as category, employee count, and contract status to filter organizations.

## Code Example
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationQueryFilter {
    private String category;
    private Integer minEmployees;
    private Integer maxEmployees;
    private Boolean hasActiveContract;
}
```