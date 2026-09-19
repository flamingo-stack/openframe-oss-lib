package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.ticket.TicketFilterOption;
import com.openframe.api.dto.ticket.TicketFilters;
import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.api.dto.ticket.TicketStatusCount;
import com.openframe.api.dto.ticket.TicketStatusDefinitionCount;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.AdminTicketOwner;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketOwnerType;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.external.dto.ticket.TicketAttachmentResponse;
import com.openframe.external.dto.ticket.TicketFilterOptionResponse;
import com.openframe.external.dto.ticket.TicketFiltersResponse;
import com.openframe.external.dto.ticket.TicketNoteResponse;
import com.openframe.external.dto.ticket.TicketOwnerResponse;
import com.openframe.external.dto.ticket.TicketResponse;
import com.openframe.external.dto.ticket.TicketStatisticsResponse;
import com.openframe.external.dto.ticket.TicketStatusResponse;
import com.openframe.external.dto.ticket.TicketTagResponse;
import com.openframe.external.dto.ticket.TicketsResponse;
import com.openframe.external.mapper.TicketMapper.TicketRelations;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TicketMapperTest {

    private static final Instant CREATED = Instant.parse("2026-01-10T08:00:00Z");
    private static final Instant UPDATED = Instant.parse("2026-01-11T09:30:00Z");
    private static final Instant RESOLVED = Instant.parse("2026-01-12T10:45:00Z");

    private final TicketMapper mapper = new TicketMapper();

    @Test
    void ticketFieldsAreCopiedAndOrganizationIsExposedAsCustomer() {
        Ticket ticket = Ticket.builder()
                .id("t-1")
                .tenantId("tenant-1")
                .ticketNumber(42)
                .title("Printer is on fire")
                .description("Smoke everywhere")
                .status(TicketStatus.RESOLVED)
                .statusId("st-resolved")
                .statusKind(TicketStatusKind.RESOLVED)
                .creationSource(TicketCreationSource.ADMIN_DASHBOARD)
                .owner(new AdminTicketOwner("user-9"))
                .deviceId("machine-1")
                .deviceHostname("front-desk")
                .organizationId("org-1")
                .organizationName("Acme")
                .reporterId("rep-1")
                .reporterName("Rita Reporter")
                .assignedTo("user-2")
                .assignedName("Tim Tech")
                .escalatedByUser(true)
                .order("a0")
                .createdAt(CREATED)
                .updatedAt(UPDATED)
                .resolvedAt(RESOLVED)
                .resolvedBy(TicketResolver.TECHNICIAN)
                .resolvedById("user-2")
                .resolvedByName("Tim Tech")
                .reopenCount(3)
                .build();

        TicketResponse response = mapper.toTicketResponse(ticket, null);

        assertEquals("t-1", response.getId());
        assertEquals(42, response.getTicketNumber());
        assertEquals("Printer is on fire", response.getTitle());
        assertEquals("Smoke everywhere", response.getDescription());
        assertEquals(TicketStatus.RESOLVED, response.getStatus());
        assertEquals(TicketStatusKind.RESOLVED, response.getStatusKind());
        assertEquals(TicketCreationSource.ADMIN_DASHBOARD, response.getCreationSource());
        assertEquals(new TicketOwnerResponse(TicketOwnerType.ADMIN, null, "user-9"), response.getOwner());
        assertEquals("machine-1", response.getDeviceId());
        assertEquals("front-desk", response.getDeviceHostname());
        assertEquals("org-1", response.getCustomerId());
        assertEquals("Acme", response.getCustomerName());
        assertEquals("rep-1", response.getReporterId());
        assertEquals("Rita Reporter", response.getReporterName());
        assertEquals("user-2", response.getAssignedTo());
        assertEquals("Tim Tech", response.getAssignedName());
        assertEquals(true, response.getEscalatedByUser());
        assertEquals(true, response.getAiDisabled());
        assertEquals("a0", response.getOrder());
        assertEquals(CREATED, response.getCreatedAt());
        assertEquals(UPDATED, response.getUpdatedAt());
        assertEquals(RESOLVED, response.getResolvedAt());
        assertEquals(TicketResolver.TECHNICIAN, response.getResolvedBy());
        assertEquals("Tim Tech", response.getResolvedByName());
        assertEquals(3, response.getReopenCount());
    }

    @Test
    void relationsAreMappedIntoTheTicketResponse() {
        Ticket ticket = Ticket.builder().id("t-1").statusId("st-custom").statusKind(TicketStatusKind.CUSTOM).build();
        TicketRelations relations = new TicketRelations(
                List.of(tag("tag-1", "vip"), tag("tag-2", "hardware")),
                List.of(note("n-1", "t-1")),
                List.of(attachment("a-1", "t-1")),
                status("st-custom", TicketStatusKind.CUSTOM, "In progress"),
                List.of(status("st-resolved", TicketStatusKind.RESOLVED, "Resolved")));

        TicketResponse response = mapper.toTicketResponse(ticket, relations);

        assertEquals(List.of("tag-1", "tag-2"), response.getTags().stream().map(TicketTagResponse::getId).toList());
        assertEquals(List.of("n-1"), response.getNotes().stream().map(TicketNoteResponse::getId).toList());
        assertEquals(List.of("a-1"), response.getAttachments().stream().map(TicketAttachmentResponse::getId).toList());
        assertEquals("st-custom", response.getStatusDefinition().getId());
        assertEquals("In progress", response.getStatusDefinition().getName());
        assertEquals(List.of("st-resolved"),
                response.getAvailableTransitions().stream().map(TicketStatusResponse::getId).toList());
    }

    @Test
    void nullRelationsFallBackToEmptyCollectionsAndNoLifecycleData() {
        TicketResponse response = mapper.toTicketResponse(Ticket.builder().id("t-1").build(), null);

        assertEquals(List.of(), response.getTags());
        assertEquals(List.of(), response.getNotes());
        assertEquals(List.of(), response.getAttachments());
        assertNull(response.getStatusDefinition());
        assertNull(response.getAvailableTransitions());
        assertNull(response.getOwner());
    }

    @Test
    void nullAvailableTransitionsStayNullWhileAnEmptyListStaysEmpty() {
        Ticket ticket = Ticket.builder().id("t-1").build();

        TicketResponse skipped = mapper.toTicketResponse(ticket,
                new TicketRelations(List.of(), List.of(), List.of(), null, null));
        TicketResponse terminal = mapper.toTicketResponse(ticket,
                new TicketRelations(List.of(), List.of(), List.of(), null, List.of()));

        assertNull(skipped.getAvailableTransitions());
        assertEquals(List.of(), terminal.getAvailableTransitions());
    }

    @Test
    void nullTagsInRelationsBecomeAnEmptyList() {
        TicketResponse response = mapper.toTicketResponse(Ticket.builder().id("t-1").build(),
                new TicketRelations(null, List.of(), List.of(), null, null));

        assertEquals(List.of(), response.getTags());
    }

    @Test
    void emptyRelationsHaveNoRelatedDataAndNoLifecycleData() {
        TicketRelations empty = TicketRelations.empty();

        assertEquals(List.of(), empty.tags());
        assertEquals(List.of(), empty.notes());
        assertEquals(List.of(), empty.attachments());
        assertNull(empty.statusDefinition());
        assertNull(empty.availableTransitions());
    }

    @Test
    void aiIsDisabledOnlyOnceTheTicketLeftAiAssistance() {
        assertEquals(false, mapper.toTicketResponse(Ticket.builder().build(), null).getAiDisabled());
        assertEquals(false, mapper.toTicketResponse(
                Ticket.builder().statusKind(TicketStatusKind.AI_ASSISTANCE).build(), null).getAiDisabled());
        assertEquals(true, mapper.toTicketResponse(
                Ticket.builder().statusKind(TicketStatusKind.TECH_REQUIRED).build(), null).getAiDisabled());
    }

    @Test
    void ticketsResponseCarriesThePageInfoAndFilteredCountOfTheQueryResult() {
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("t-1").endCursor("t-2").build();
        CountedGenericQueryResult<Ticket> result = CountedGenericQueryResult.<Ticket>builder()
                .items(List.of())
                .pageInfo(pageInfo)
                .filteredCount(17)
                .build();
        List<TicketResponse> tickets = List.of(TicketResponse.builder().id("t-1").build());

        TicketsResponse response = mapper.toTicketsResponse(result, tickets);

        assertSame(tickets, response.getTickets());
        assertSame(pageInfo, response.getPageInfo());
        assertEquals(17, response.getFilteredCount());
    }

    @Test
    void nullOwnerMapsToNull() {
        assertNull(mapper.toOwnerResponse(null));
    }

    @Test
    void clientOwnerExposesOnlyTheMachineId() {
        TicketOwnerResponse response = mapper.toOwnerResponse(new ClientTicketOwner("machine-7"));

        assertEquals(new TicketOwnerResponse(TicketOwnerType.CLIENT, "machine-7", null), response);
    }

    @Test
    void adminOwnerExposesOnlyTheUserId() {
        TicketOwnerResponse response = mapper.toOwnerResponse(new AdminTicketOwner("user-7"));

        assertEquals(new TicketOwnerResponse(TicketOwnerType.ADMIN, null, "user-7"), response);
    }

    @Test
    void unknownOwnerSubtypeKeepsOnlyTheType() {
        TicketOwner owner = new TicketOwner() {
        };
        owner.setType(TicketOwnerType.ADMIN);

        assertEquals(new TicketOwnerResponse(TicketOwnerType.ADMIN, null, null), mapper.toOwnerResponse(owner));
    }

    @Test
    void nullStatusMapsToNull() {
        assertNull(mapper.toStatusResponse(null));
    }

    @Test
    void systemStatusIsFlaggedAndCarriesItsKindAsSystemKey() {
        TicketStatusDefinition status = TicketStatusDefinition.builder()
                .id("st-tech")
                .tenantId("tenant-1")
                .kind(TicketStatusKind.TECH_REQUIRED)
                .name("Tech required")
                .color("#ff0000")
                .position("a1")
                .staleAfterMinutes(60)
                .createdAt(CREATED)
                .updatedAt(UPDATED)
                .build();

        TicketStatusResponse response = mapper.toStatusResponse(status);

        assertEquals("st-tech", response.getId());
        assertEquals("Tech required", response.getName());
        assertEquals("#ff0000", response.getColor());
        assertEquals("a1", response.getPosition());
        assertEquals(TicketStatusKind.TECH_REQUIRED, response.getKind());
        assertEquals(true, response.getIsSystem());
        assertEquals("TECH_REQUIRED", response.getSystemKey());
        assertEquals(CREATED, response.getCreatedAt());
        assertEquals(UPDATED, response.getUpdatedAt());
    }

    @Test
    void customStatusIsNotSystemAndHasNoSystemKey() {
        TicketStatusResponse response = mapper.toStatusResponse(status("st-1", TicketStatusKind.CUSTOM, "Waiting"));

        assertEquals(TicketStatusKind.CUSTOM, response.getKind());
        assertEquals(false, response.getIsSystem());
        assertNull(response.getSystemKey());
    }

    @Test
    void statusWithoutKindIsNotSystem() {
        TicketStatusResponse response = mapper.toStatusResponse(status("st-1", null, "Legacy"));

        assertNull(response.getKind());
        assertEquals(false, response.getIsSystem());
        assertNull(response.getSystemKey());
    }

    @Test
    void statusListKeepsOrderAndNullBecomesEmpty() {
        List<TicketStatusResponse> responses = mapper.toStatusResponses(List.of(
                status("st-2", TicketStatusKind.CUSTOM, "Second"),
                status("st-1", TicketStatusKind.RESOLVED, "First")));

        assertEquals(List.of("st-2", "st-1"), responses.stream().map(TicketStatusResponse::getId).toList());
        assertEquals(List.of(), mapper.toStatusResponses(null));
    }

    @Test
    void tagFieldsAreCopied() {
        Tag tag = Tag.builder()
                .id("tag-1")
                .tenantId("tenant-1")
                .key("vip")
                .description("Very important")
                .color("#00ff00")
                .values(List.of("ignored"))
                .createdAt(CREATED)
                .createdBy("user-1")
                .build();

        TicketTagResponse response = mapper.toTagResponse(tag);

        assertEquals("tag-1", response.getId());
        assertEquals("vip", response.getKey());
        assertEquals("Very important", response.getDescription());
        assertEquals("#00ff00", response.getColor());
        assertEquals(CREATED, response.getCreatedAt());
        assertEquals("user-1", response.getCreatedBy());
    }

    @Test
    void tagListKeepsOrderAndNullBecomesEmpty() {
        List<TicketTagResponse> responses = mapper.toTagResponses(List.of(tag("tag-2", "b"), tag("tag-1", "a")));

        assertEquals(List.of("tag-2", "tag-1"), responses.stream().map(TicketTagResponse::getId).toList());
        assertEquals(List.of(), mapper.toTagResponses(null));
    }

    @Test
    void noteFieldsAreCopied() {
        TicketNote note = TicketNote.builder()
                .id("n-1")
                .tenantId("tenant-1")
                .ticketId("t-1")
                .content("Called the customer")
                .authorId("user-1")
                .createdAt(CREATED)
                .updatedAt(UPDATED)
                .build();

        TicketNoteResponse response = mapper.toNoteResponse(note);

        assertEquals("n-1", response.getId());
        assertEquals("t-1", response.getTicketId());
        assertEquals("Called the customer", response.getContent());
        assertEquals("user-1", response.getAuthorId());
        assertEquals(CREATED, response.getCreatedAt());
        assertEquals(UPDATED, response.getUpdatedAt());
    }

    @Test
    void attachmentFieldsAreCopied() {
        TicketAttachment attachment = TicketAttachment.builder()
                .id("a-1")
                .tenantId("tenant-1")
                .ticketId("t-1")
                .fileName("screenshot.png")
                .contentType("image/png")
                .fileSize(2048L)
                .storagePath("tickets/t-1/a-1")
                .uploadedAt(CREATED)
                .uploadedBy("user-1")
                .build();

        TicketAttachmentResponse response = mapper.toAttachmentResponse(attachment);

        assertEquals("a-1", response.getId());
        assertEquals("t-1", response.getTicketId());
        assertEquals("screenshot.png", response.getFileName());
        assertEquals("image/png", response.getContentType());
        assertEquals(2048L, response.getFileSize());
        assertEquals(CREATED, response.getUploadedAt());
        assertEquals("user-1", response.getUploadedBy());
    }

    @Test
    void filterOptionsAreCopiedAndOrganizationsAreExposedAsCustomers() {
        TicketFilters filters = TicketFilters.builder()
                .statuses(List.of(new TicketFilterOption("st-1", "Open")))
                .organizationIds(List.of(new TicketFilterOption("org-1", "Acme")))
                .assigneeIds(List.of(new TicketFilterOption("user-2", "Tim Tech")))
                .tagIds(List.of(new TicketFilterOption("tag-1", "vip")))
                .build();

        TicketFiltersResponse response = mapper.toFiltersResponse(filters);

        assertEquals(List.of(new TicketFilterOptionResponse("st-1", "Open")), response.getStatuses());
        assertEquals(List.of(new TicketFilterOptionResponse("org-1", "Acme")), response.getCustomerIds());
        assertEquals(List.of(new TicketFilterOptionResponse("user-2", "Tim Tech")), response.getAssigneeIds());
        assertEquals(List.of(new TicketFilterOptionResponse("tag-1", "vip")), response.getTagIds());
    }

    @Test
    void missingFilterOptionListsBecomeEmpty() {
        TicketFiltersResponse response = mapper.toFiltersResponse(new TicketFilters());

        assertEquals(List.of(), response.getStatuses());
        assertEquals(List.of(), response.getCustomerIds());
        assertEquals(List.of(), response.getAssigneeIds());
        assertEquals(List.of(), response.getTagIds());
    }

    @Test
    void nullFiltersStillProduceAResponse() {
        assertNotNull(mapper.toFiltersResponse(null));
    }

    @Test
    void statisticsAreCopiedWithStatusDefinitionsMapped() {
        TicketStatistics statistics = TicketStatistics.builder()
                .totalCount(12)
                .statusCounts(List.of(
                        new TicketStatusCount(TicketStatus.ACTIVE, 7),
                        new TicketStatusCount(TicketStatus.RESOLVED, 5)))
                .statusDefinitionCounts(List.of(
                        new TicketStatusDefinitionCount(status("st-ai", TicketStatusKind.AI_ASSISTANCE, "AI"), 4),
                        new TicketStatusDefinitionCount(null, 8)))
                .averageResolutionTimeFormatted("2h 15m")
                .averageRating(4.5)
                .build();

        TicketStatisticsResponse response = mapper.toStatisticsResponse(statistics);

        assertEquals(12, response.getTotalCount());
        assertEquals(List.of(
                new TicketStatisticsResponse.StatusCount(TicketStatus.ACTIVE, 7),
                new TicketStatisticsResponse.StatusCount(TicketStatus.RESOLVED, 5)), response.getStatusCounts());
        assertEquals(2, response.getStatusDefinitionCounts().size());
        TicketStatisticsResponse.StatusDefinitionCount aiCount = response.getStatusDefinitionCounts().get(0);
        assertEquals("st-ai", aiCount.getStatus().getId());
        assertTrue(aiCount.getStatus().getIsSystem());
        assertEquals("AI_ASSISTANCE", aiCount.getStatus().getSystemKey());
        assertEquals(4, aiCount.getCount());
        assertNull(response.getStatusDefinitionCounts().get(1).getStatus());
        assertEquals(8, response.getStatusDefinitionCounts().get(1).getCount());
        assertEquals("2h 15m", response.getAverageResolutionTimeFormatted());
        assertEquals(4.5, response.getAverageRating());
    }

    @Test
    void missingStatisticsCountListsBecomeEmpty() {
        TicketStatisticsResponse response = mapper.toStatisticsResponse(new TicketStatistics());

        assertNull(response.getTotalCount());
        assertEquals(List.of(), response.getStatusCounts());
        assertEquals(List.of(), response.getStatusDefinitionCounts());
        assertNull(response.getAverageResolutionTimeFormatted());
        assertNull(response.getAverageRating());
    }

    private static Tag tag(String id, String key) {
        return Tag.builder().id(id).key(key).build();
    }

    private static TicketNote note(String id, String ticketId) {
        return TicketNote.builder().id(id).ticketId(ticketId).content("note " + id).build();
    }

    private static TicketAttachment attachment(String id, String ticketId) {
        return TicketAttachment.builder().id(id).ticketId(ticketId).fileName(id + ".txt").build();
    }

    private static TicketStatusDefinition status(String id, TicketStatusKind kind, String name) {
        return TicketStatusDefinition.builder().id(id).kind(kind).name(name).build();
    }
}
