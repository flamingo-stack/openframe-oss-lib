package com.openframe.test.api.graphql;

public class OrganizationQueries {
    public static final String ORGANIZATIONS = """
            query($first: Int, $after: String, $filter: OrganizationFilterInput, $orderBy: OrganizationSortInput) {
                organizations(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                    edges {
                        node {
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
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
            """;

    public static final String ORGANIZATION_BY_ORGANIZATION_ID = """
            query($organizationId: String!) {
                organizationByOrganizationId(organizationId: $organizationId) {
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
            }
            """;
}
