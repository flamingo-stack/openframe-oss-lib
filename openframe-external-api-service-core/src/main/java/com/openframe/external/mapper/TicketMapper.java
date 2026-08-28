package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.ticket.TicketFilterOption;
import com.openframe.api.dto.ticket.TicketFilters;
import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.AdminTicketOwner;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.external.dto.ticket.*;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TicketMapper extends BaseRestMapper {

    /** Per-ticket related data gathered by the read service. */
    public record TicketRelations(List<Tag> tags,
                                  List<TicketNote> notes,
                                  List<TicketAttachment> attachments,
                                  TicketStatusDefinition statusDefinition,
                                  List<TicketStatusDefinition> availableTransitions) {
        public static TicketRelations empty() {
            return new TicketRelations(List.of(), List.of(), List.of(), null, null);
        }
    }

    public TicketResponse toTicketResponse(Ticket ticket, TicketRelations relations) {
        TicketRelations rel = relations != null ? relations : TicketRelations.empty();
        return TicketResponse.builder()
                .id(ticket.getId())
                .ticketNumber(ticket.getTicketNumber())
                .title(ticket.getTitle())
                .description(ticket.getDescription())
                .status(ticket.getStatus())
                .statusKind(ticket.getStatusKind())
                .statusDefinition(toStatusResponse(rel.statusDefinition()))
                .availableTransitions(rel.availableTransitions() == null ? null : toStatusResponses(rel.availableTransitions()))
                .creationSource(ticket.getCreationSource())
                .owner(toOwnerResponse(ticket.getOwner()))
                .deviceId(ticket.getDeviceId())
                .deviceHostname(ticket.getDeviceHostname())
                .customerId(ticket.getOrganizationId())
                .customerName(ticket.getOrganizationName())
                .reporterId(ticket.getReporterId())
                .reporterName(ticket.getReporterName())
                .assignedTo(ticket.getAssignedTo())
                .assignedName(ticket.getAssignedName())
                .escalatedByUser(ticket.getEscalatedByUser())
                .aiDisabled(ticket.isAiDisabled())
                .tags(toTagResponses(rel.tags()))
                .attachments(rel.attachments().stream().map(this::toAttachmentResponse).toList())
                .notes(rel.notes().stream().map(this::toNoteResponse).toList())
                .order(ticket.getOrder())
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt())
                .resolvedAt(ticket.getResolvedAt())
                .resolvedBy(ticket.getResolvedBy())
                .resolvedByName(ticket.getResolvedByName())
                .reopenCount(ticket.getReopenCount())
                .build();
    }

    public TicketsResponse toTicketsResponse(CountedGenericQueryResult<Ticket> result, List<TicketResponse> tickets) {
        return TicketsResponse.builder()
                .tickets(tickets)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    public TicketOwnerResponse toOwnerResponse(TicketOwner owner) {
        if (owner == null) {
            return null;
        }
        TicketOwnerResponse.TicketOwnerResponseBuilder builder = TicketOwnerResponse.builder().type(owner.getType());
        if (owner instanceof ClientTicketOwner client) {
            builder.machineId(client.getMachineId());
        } else if (owner instanceof AdminTicketOwner admin) {
            builder.userId(admin.getUserId());
        }
        return builder.build();
    }

    public TicketStatusResponse toStatusResponse(TicketStatusDefinition status) {
        if (status == null) {
            return null;
        }
        boolean system = status.getKind() != null && status.getKind().isSystem();
        return TicketStatusResponse.builder()
                .id(status.getId())
                .name(status.getName())
                .color(status.getColor())
                .position(status.getPosition())
                .kind(status.getKind())
                .isSystem(system)
                .systemKey(system ? status.getKind().name() : null)
                .createdAt(status.getCreatedAt())
                .updatedAt(status.getUpdatedAt())
                .build();
    }

    public List<TicketStatusResponse> toStatusResponses(List<TicketStatusDefinition> statuses) {
        return statuses == null ? List.of() : statuses.stream().map(this::toStatusResponse).toList();
    }

    public TicketTagResponse toTagResponse(Tag tag) {
        return TicketTagResponse.builder()
                .id(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .createdAt(tag.getCreatedAt())
                .createdBy(tag.getCreatedBy())
                .build();
    }

    public List<TicketTagResponse> toTagResponses(List<Tag> tags) {
        return tags == null ? List.of() : tags.stream().map(this::toTagResponse).toList();
    }

    public TicketNoteResponse toNoteResponse(TicketNote note) {
        return TicketNoteResponse.builder()
                .id(note.getId())
                .ticketId(note.getTicketId())
                .content(note.getContent())
                .authorId(note.getAuthorId())
                .createdAt(note.getCreatedAt())
                .updatedAt(note.getUpdatedAt())
                .build();
    }

    public TicketAttachmentResponse toAttachmentResponse(TicketAttachment attachment) {
        return TicketAttachmentResponse.builder()
                .id(attachment.getId())
                .ticketId(attachment.getTicketId())
                .fileName(attachment.getFileName())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .uploadedAt(attachment.getUploadedAt())
                .uploadedBy(attachment.getUploadedBy())
                .build();
    }

    public TicketFiltersResponse toFiltersResponse(TicketFilters filters) {
        if (filters == null) {
            return TicketFiltersResponse.builder().build();
        }
        return TicketFiltersResponse.builder()
                .statuses(toFilterOptions(filters.getStatuses()))
                .customerIds(toFilterOptions(filters.getOrganizationIds()))
                .assigneeIds(toFilterOptions(filters.getAssigneeIds()))
                .tagIds(toFilterOptions(filters.getTagIds()))
                .build();
    }

    private List<TicketFilterOptionResponse> toFilterOptions(List<TicketFilterOption> options) {
        return options == null ? List.of() : options.stream()
                .map(option -> TicketFilterOptionResponse.builder()
                        .value(option.getValue())
                        .label(option.getLabel())
                        .build())
                .toList();
    }

    public TicketStatisticsResponse toStatisticsResponse(TicketStatistics statistics) {
        return TicketStatisticsResponse.builder()
                .totalCount(statistics.getTotalCount())
                .statusCounts(statistics.getStatusCounts() == null ? List.of() : statistics.getStatusCounts().stream()
                        .map(count -> TicketStatisticsResponse.StatusCount.builder()
                                .status(count.getStatus())
                                .count(count.getCount())
                                .build())
                        .toList())
                .statusDefinitionCounts(statistics.getStatusDefinitionCounts() == null ? List.of()
                        : statistics.getStatusDefinitionCounts().stream()
                        .map(count -> TicketStatisticsResponse.StatusDefinitionCount.builder()
                                .status(toStatusResponse(count.getStatus()))
                                .count(count.getCount())
                                .build())
                        .toList())
                .averageResolutionTimeFormatted(statistics.getAverageResolutionTimeFormatted())
                .averageRating(statistics.getAverageRating())
                .build();
    }
}
