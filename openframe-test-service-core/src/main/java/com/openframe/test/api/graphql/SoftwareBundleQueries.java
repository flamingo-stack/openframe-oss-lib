package com.openframe.test.api.graphql;

// Software bundle documents on api/graphql (software-bundle.graphqls): the draft behind Install / Update Software, its device pickers and its submit.
public class SoftwareBundleQueries {

    private static final String BUNDLE_FIELDS = """
            fragment bundleFields on SoftwareBundle {
                id
                status
                action
                mode
                packages { packageManager packageName brewPackageType version }
                deviceCount
                startAt
                scheduleId
                executionIds
                createdBy
                createdAt
                updatedAt
                completedAt
            }
            """;

    private static final String DEVICE_NODE = "node { id machineId hostname osType status organizationId }";

    public static final String GET_SOFTWARE_BUNDLE = """
            query SoftwareBundle($id: ID!) {
                softwareBundle(id: $id) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    // Both pickers narrowed by the same filter and search, so a shared tenant does not page.
    public static final String GET_SOFTWARE_BUNDLE_DEVICES = """
            query SoftwareBundleDevices($id: ID!, $filter: DeviceFilterInput, $search: String, $first: Int) {
                softwareBundle(id: $id) {
                    ...bundleFields
                    assignedDevices(filter: $filter, search: $search, first: $first) {
                        filteredCount
                        edges { %s cursor }
                    }
                    availableDevices(filter: $filter, search: $search, first: $first) {
                        filteredCount
                        edges { %s cursor assigned }
                    }
                }
            }
            """.formatted(DEVICE_NODE, DEVICE_NODE) + BUNDLE_FIELDS;

    public static final String CREATE_SOFTWARE_BUNDLE = """
            mutation CreateSoftwareBundle {
                createSoftwareBundle {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    public static final String ADD_DEVICES_TO_SOFTWARE_BUNDLE = """
            mutation AddDevicesToSoftwareBundle($bundleId: ID!, $machineIds: [ID!]!) {
                addDevicesToSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    public static final String REMOVE_DEVICES_FROM_SOFTWARE_BUNDLE = """
            mutation RemoveDevicesFromSoftwareBundle($bundleId: ID!, $machineIds: [ID!]!) {
                removeDevicesFromSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    public static final String ADD_ALL_DEVICES_TO_SOFTWARE_BUNDLE = """
            mutation AddAllDevicesToSoftwareBundle($bundleId: ID!, $filter: DeviceFilterInput, $search: String) {
                addAllDevicesToSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    public static final String REMOVE_ALL_DEVICES_FROM_SOFTWARE_BUNDLE = """
            mutation RemoveAllDevicesFromSoftwareBundle($bundleId: ID!, $filter: DeviceFilterInput, $search: String) {
                removeAllDevicesFromSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    // Run now when the input has no schedule; the bundle comes back COMPLETED.
    public static final String SUBMIT_SOFTWARE_BUNDLE = """
            mutation SubmitSoftwareBundle($input: SubmitSoftwareBundleInput!) {
                submitSoftwareBundle(input: $input) {
                    ...bundleFields
                }
            }
            """ + BUNDLE_FIELDS;

    public static final String DELETE_SOFTWARE_BUNDLE = """
            mutation DeleteSoftwareBundle($id: ID!) {
                deleteSoftwareBundle(id: $id)
            }
            """;
}
