package com.openframe.test.api.graphql;

public class OrganizationQueries {

    private static final String ORGANIZATION_FIELDS = """
            fragment organizationFields on Organization {
                id
                name
                organizationId
                category
                numberOfEmployees
                websiteUrl
                notes
                contactInformation {
                    contacts {
                        contactName
                        title
                        phone
                        email
                    }
                    physicalAddress {
                        street1
                        street2
                        city
                        state
                        postalCode
                        country
                    }
                    mailingAddress {
                        street1
                        street2
                        city
                        state
                        postalCode
                        country
                    }
                    mailingAddressSameAsPhysical
                }
                monthlyRevenue
                contractStartDate
                contractEndDate
                createdAt
                updatedAt
                lastActivityAt
                isDefault
                status
                statusChangedAt
            }
            """;

    public static final String ORGANIZATIONS = """
            query($first: Int, $after: String, $filter: OrganizationFilterInput, $orderBy: OrganizationSortInput) {
                organizations(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                    edges {
                        node { ...organizationFields }
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
            """ + ORGANIZATION_FIELDS;

    // id is the Relay global id (Organization.id), not the raw organizationId.
    public static final String ORGANIZATION = """
            query($id: ID!) {
                organization(id: $id) { ...organizationFields }
            }
            """ + ORGANIZATION_FIELDS;

    public static final String ORGANIZATION_BY_ORGANIZATION_ID = """
            query($organizationId: String!) {
                organizationByOrganizationId(organizationId: $organizationId) { ...organizationFields }
            }
            """ + ORGANIZATION_FIELDS;
}
