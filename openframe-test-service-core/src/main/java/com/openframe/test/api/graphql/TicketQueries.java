package com.openframe.test.api.graphql;

public class TicketQueries {

    public static final String TICKET_TAGS = """
            query TicketTags {
                ticketTags {
                    id
                    key
                    description
                    color
                    createdAt
                    createdBy
                }
            }
            """;

    public static final String GET_TICKETS = """
            query GetTickets($filter: TicketFilterInput, $pagination: CursorPaginationInput, $search: String) {
                tickets(filter: $filter, pagination: $pagination, search: $search, sort: { field: "order", direction: ASC }) {
                    edges {
                        cursor
                        node {
                            id
                            ticketNumber
                            title
                            status
                            statusDefinition { id name kind }
                            owner {
                                ... on ClientTicketOwner {
                                    type
                                    machineId
                                    machine { id machineId hostname organizationId }
                                }
                                ... on AdminTicketOwner {
                                    type
                                    userId
                                    user { id firstName lastName }
                                }
                            }
                            deviceId
                            deviceHostname
                            organizationId
                            organizationName
                            assignedTo
                            assignedName
                            assigneeImage { imageUrl }
                            tags { id key color }
                            createdAt
                            updatedAt
                            resolvedAt
                            order
                        }
                    }
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }
                    filteredCount
                }
            }
            """;

    public static final String GET_TICKET = """
            query GetTicket($id: ID!) {
                ticket(id: $id) {
                    id
                    ticketNumber
                    title
                    description
                    status
                    statusDefinition { id name kind }
                    creationSource
                    owner {
                        ... on ClientTicketOwner {
                            type
                            machineId
                            machine { id machineId hostname organizationId }
                        }
                        ... on AdminTicketOwner {
                            type
                            userId
                            user { id firstName lastName }
                        }
                    }
                    deviceId
                    deviceHostname
                    organizationId
                    organizationName
                    organizationImage { imageUrl }
                    assignedTo
                    assignedName
                    assigneeImage { imageUrl }
                    tags { id key color }
                    dialog {
                        id
                        currentMode
                        tokenUsage {
                            chatType
                            inputTokensSize
                            outputTokensSize
                            totalTokensSize
                            contextSize
                        }
                    }
                    attachments {
                        id
                        ticketId
                        fileName
                        contentType
                        fileSize
                        uploadedAt
                        uploadedBy
                    }
                    notes {
                        id
                        ticketId
                        content
                        authorId
                        author { id firstName lastName }
                        authorImage { imageUrl }
                        createdAt
                        updatedAt
                    }
                    createdAt
                    updatedAt
                    resolvedAt
                    order
                }
            }
            """;

    public static final String REORDER_TICKET = """
            mutation ReorderTicket($input: ReorderTicketInput!) {
                reorderTicket(input: $input) {
                    ticket { id status statusDefinition { id name kind } order }
                    userErrors { field message }
                }
            }
            """;

    public static final String TICKET_STATUSES = """
            query TicketStatuses {
                ticketStatuses {
                    id
                    name
                    color
                    position
                    kind
                    isSystem
                    systemKey
                }
            }
            """;

    public static final String CREATE_TICKET_STATUS = """
            mutation CreateTicketStatus($input: CreateTicketStatusInput!) {
                createTicketStatus(input: $input) {
                    id
                    name
                    color
                    position
                    kind
                    isSystem
                    systemKey
                }
            }
            """;

    public static final String DELETE_TICKET_STATUS = """
            mutation DeleteTicketStatus($input: DeleteTicketStatusInput!) {
                deleteTicketStatus(input: $input)
            }
            """;

    public static final String TRANSITION_TICKET = """
            mutation TransitionTicket($input: TransitionTicketInput!) {
                transitionTicket(input: $input) {
                    ticket { id status statusDefinition { id name kind } resolvedAt }
                    userErrors { field message }
                }
            }
            """;

    /** One transition plus one assignment; a transition the rules matrix forbids comes back as an error. */
    public static final String TAKE_OVER_TICKET = """
            mutation TakeOverTicket($input: TakeOverTicketInput!) {
                takeOverTicket(input: $input) {
                    ticket { id status statusDefinition { id name kind } assignedTo assignedName resolvedAt }
                    userErrors { field message }
                }
            }
            """;

    /**
     * Client-initiated reopen of a closed ticket (AGENT callers only). The destination is chosen by
     * the server: a ticket the client closed returns to AI Handling, one a technician closed goes to
     * Tech Required; {@code handoffToTechnician} forces the latter. Idempotent on an open ticket.
     */
    public static final String REQUEST_TICKET_REOPEN = """
            mutation RequestTicketReopen($input: TicketReopenInput!) {
                requestTicketReopen(input: $input) {
                    ticketId
                    targetStatusKind
                    userErrors { field message }
                }
            }
            """;

    private static final String TICKET_EDIT_FIELDS = """
                    ticket {
                        id
                        title
                        description
                        assignedTo
                        deviceId
                        organizationId
                        statusDefinition { id name kind }
                        tags { id key }
                        attachments { id fileName contentType fileSize }
                    }
                    userErrors { field message }
            """;

    /** A ticket's editable state plus its notes and attachments, for the CP-11/12 cases. */
    public static final String GET_TICKET_DETAILS = """
            query GetTicketDetails($id: ID!) {
                ticket(id: $id) {
                    id
                    title
                    description
                    assignedTo
                    deviceId
                    organizationId
                    statusDefinition { id name kind }
                    tags { id key }
                    notes { id ticketId content authorId createdAt updatedAt }
                    attachments { id ticketId fileName contentType fileSize uploadedAt }
                }
            }
            """;

    public static final String UPDATE_TICKET = """
            mutation UpdateTicket($input: UpdateTicketInput!) {
                updateTicket(input: $input) {
            """ + TICKET_EDIT_FIELDS + """
                }
            }
            """;

    public static final String ASSIGN_TICKET = """
            mutation AssignTicket($input: AssignTicketInput!) {
                assignTicket(input: $input) {
            """ + TICKET_EDIT_FIELDS + """
                }
            }
            """;

    public static final String UNASSIGN_TICKET = """
            mutation UnassignTicket($input: TicketIdInput!) {
                unassignTicket(input: $input) {
            """ + TICKET_EDIT_FIELDS + """
                }
            }
            """;

    public static final String UNLINK_DEVICE_FROM_TICKET = """
            mutation UnlinkDeviceFromTicket($input: TicketIdInput!) {
                unlinkDeviceFromTicket(input: $input) {
            """ + TICKET_EDIT_FIELDS + """
                }
            }
            """;

    public static final String UNLINK_ORGANIZATION_FROM_TICKET = """
            mutation UnlinkOrganizationFromTicket($input: TicketIdInput!) {
                unlinkOrganizationFromTicket(input: $input) {
            """ + TICKET_EDIT_FIELDS + """
                }
            }
            """;

    private static final String NOTE_PAYLOAD = """
                    note { id ticketId content authorId createdAt updatedAt }
                    userErrors { field message }
            """;

    public static final String ADD_TICKET_NOTE = """
            mutation AddTicketNote($input: AddTicketNoteInput!) {
                addTicketNote(input: $input) {
            """ + NOTE_PAYLOAD + """
                }
            }
            """;

    public static final String UPDATE_TICKET_NOTE = """
            mutation UpdateTicketNote($input: UpdateTicketNoteInput!) {
                updateTicketNote(input: $input) {
            """ + NOTE_PAYLOAD + """
                }
            }
            """;

    private static final String DELETE_PAYLOAD = """
                    deletedId
                    userErrors { field message }
            """;

    public static final String DELETE_TICKET_NOTE = """
            mutation DeleteTicketNote($input: DeleteByIdInput!) {
                deleteTicketNote(input: $input) {
            """ + DELETE_PAYLOAD + """
                }
            }
            """;

    public static final String CREATE_TEMP_ATTACHMENT_UPLOAD_URL = """
            mutation CreateTempAttachmentUploadUrl($input: CreateTempAttachmentInput!) {
                createTempAttachmentUploadUrl(input: $input) {
                    tempAttachment { id fileName contentType fileSize uploadUrl createdAt }
                    userErrors { field message }
                }
            }
            """;

    public static final String DELETE_TEMP_ATTACHMENT = """
            mutation DeleteTempAttachment($input: DeleteByIdInput!) {
                deleteTempAttachment(input: $input) {
            """ + DELETE_PAYLOAD + """
                }
            }
            """;

    public static final String DELETE_TICKET_ATTACHMENT = """
            mutation DeleteTicketAttachment($input: DeleteByIdInput!) {
                deleteTicketAttachment(input: $input) {
            """ + DELETE_PAYLOAD + """
                }
            }
            """;

    public static final String TICKET_ATTACHMENT_DOWNLOAD_URL = """
            query TicketAttachmentDownloadUrl($attachmentId: ID!) {
                ticketAttachmentDownloadUrl(attachmentId: $attachmentId)
            }
            """;

    public static final String UPDATE_TICKET_STATUS = """
            mutation UpdateTicketStatus($input: UpdateTicketStatusInput!) {
                updateTicketStatus(input: $input) { id name color position kind isSystem systemKey }
            }
            """;

    public static final String REORDER_TICKET_STATUS = """
            mutation ReorderTicketStatus($input: ReorderTicketStatusInput!) {
                reorderTicketStatus(input: $input) { id name color position kind isSystem systemKey }
            }
            """;

    /** The lifecycle transition matrix over every status definition. */
    public static final String TICKET_STATUS_TRANSITION_RULES = """
            query TicketStatusTransitionRules {
                ticketStatusTransitionRules {
                    from { id name color position kind isSystem systemKey }
                    to { id name color position kind isSystem systemKey }
                }
            }
            """;

    public static final String TICKET_STATISTICS = """
            query TicketStatistics {
                ticketStatistics {
                    totalCount
                    statusDefinitionCounts { status { id name color position kind isSystem systemKey } count }
                    averageResolutionTimeFormatted
                    averageRating
                }
            }
            """;

    public static final String CREATE_TICKET = """
            mutation CreateTicket($input: CreateTicketInput!) {
                createTicket(input: $input) {
                    ticket {
                        id
                        ticketNumber
                        title
                        description
                        status
                        statusDefinition { id name kind }
                        owner {
                            ... on ClientTicketOwner { type machineId }
                            ... on AdminTicketOwner { type userId }
                        }
                        deviceId
                        deviceHostname
                        organizationId
                        organizationName
                        assignedTo
                        assignedName
                        tags { id key color }
                        attachments {
                            id
                            ticketId
                            fileName
                            contentType
                            fileSize
                            uploadedAt
                            uploadedBy
                        }
                        createdAt
                        updatedAt
                    }
                    userErrors { field message }
                }
            }
            """;
}
