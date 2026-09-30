package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the public package catalog (openframe-api-service-core
 * {@code package-search.graphqls}), served on {@code api/graphql}. The Software screen's install form
 * searches with {@code searchPackages} and opens the version picker with {@code packageDetails}.
 */
public class PackageSearchQueries {

    public static final String SEARCH_PACKAGES = """
            query SearchPackages($packageManager: PackageManagerType!, $search: String, $first: Int, $after: String) {
                searchPackages(packageManager: $packageManager, search: $search, first: $first, after: $after) {
                    filteredCount
                    edges {
                        node {
                            id
                            name
                            version
                            publisher
                            iconUrl
                            installCommand
                            packageType
                            popularity
                            packageManager
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String PACKAGE_DETAILS = """
            query PackageDetails($packageManager: PackageManagerType!, $packageId: ID!, $packageType: BrewPackageType) {
                packageDetails(packageManager: $packageManager, packageId: $packageId, packageType: $packageType) {
                    id
                    packageManager
                    name
                    publisher
                    installCommand
                    packageType
                    popularity
                    tags
                    versions { version releasedAt }
                }
            }
            """;
}
