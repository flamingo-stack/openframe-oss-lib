# Organization Response Documentation

## Overview
The `OrganizationResponse` class is a shared DTO for organization responses used by both GraphQL and REST APIs.

## Core Attributes
- **id**: The unique identifier for the organization.
- **name**: The name of the organization.
- **organizationId**: The organization ID.
- **category**: The category of the organization.
- **numberOfEmployees**: The number of employees in the organization.
- **websiteUrl**: The URL of the organization's website.
- **notes**: Additional notes about the organization.
- **contactInformation**: Contact information for the organization.
- **monthlyRevenue**: The monthly revenue of the organization.
- **contractStartDate**: The start date of the contract.
- **contractEndDate**: The end date of the contract.
- **createdAt**: The timestamp when the organization was created.
- **updatedAt**: The timestamp when the organization was last updated.
- **isDefault**: Indicates if this is the default organization.
- **deleted**: Indicates if the organization is deleted.
- **deletedAt**: The timestamp when the organization was deleted.

## Example
```java
OrganizationResponse orgResponse = new OrganizationResponse();
orgResponse.setId("org-001");
// Set other attributes accordingly
```