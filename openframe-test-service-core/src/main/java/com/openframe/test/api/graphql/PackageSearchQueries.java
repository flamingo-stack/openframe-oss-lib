package com.openframe.test.api.graphql;

// Public package catalog documents on api/graphql: searchPackages feeds the install form's picker, packageDetails its version list.
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
