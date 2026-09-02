package com.openframe.api.service.ticket;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.api.dto.ticket.CreateTicketStatusInput;
import com.openframe.api.dto.ticket.DeleteTicketStatusInput;
import com.openframe.api.dto.ticket.ReorderTicketStatusInput;
import com.openframe.api.dto.ticket.UpdateTicketStatusInput;
import com.openframe.api.exception.ticket.DuplicateTicketStatusNameException;
import com.openframe.api.exception.ticket.InvalidTicketStatusReorderException;
import com.openframe.api.exception.ticket.InvalidTicketStatusReplacementException;
import com.openframe.api.exception.ticket.SystemTicketStatusModificationException;
import com.openframe.api.exception.ticket.TicketStatusInUseException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.ticket.TicketStatusKind.AI_ASSISTANCE;
import static com.openframe.data.document.ticket.TicketStatusKind.ARCHIVED;
import static com.openframe.data.document.ticket.TicketStatusKind.CUSTOM;
import static com.openframe.data.document.ticket.TicketStatusKind.RESOLVED;
import static com.openframe.data.document.ticket.TicketStatusKind.TECH_REQUIRED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The tenant's status board: four seeded system statuses an admin may not touch, plus custom ones
 * they own. Every rule here protects the board — system statuses stay put, names stay unique,
 * custom columns always land between Tech Required and Resolved, and no status disappears from
 * under the tickets that sit in it.
 */
@ExtendWith(MockitoExtension.class)
class TicketStatusServiceTest {

    private static final LexoRank MIDDLE = LexoRank.middle();

    @Mock private TicketStatusDefinitionRepository statusRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private TicketTransitionPolicyValidator transitionPolicy;

    @InjectMocks private TicketStatusService service;

    private final AuthPrincipal admin = principal(ActorType.ADMIN);

    private TicketStatusDefinition aiAssistance;
    private TicketStatusDefinition techRequired;
    private TicketStatusDefinition resolved;
    private TicketStatusDefinition archived;
    private TicketStatusDefinition onHold;

    @BeforeEach
    void seedBoard() {
        LexoRank techRank = MIDDLE.genPrev();
        aiAssistance = status("st-ai", AI_ASSISTANCE, "AI Handling", techRank.genPrev());
        techRequired = status("st-tech", TECH_REQUIRED, "Tech Required", techRank);
        resolved = status("st-resolved", RESOLVED, "Resolved", MIDDLE.genNext());
        archived = status("st-archived", ARCHIVED, "Archived", MIDDLE.genNext().genNext());
        onHold = status("st-hold", CUSTOM, "On Hold", MIDDLE);
    }

    @Nested
    class Listing {

        @Test
        void list_returnsTheBoardInPositionOrder() {
            List<TicketStatusDefinition> board = List.of(aiAssistance, techRequired, onHold, resolved, archived);
            when(statusRepository.findAllByOrderByPositionAsc()).thenReturn(board);

            assertThat(service.list()).containsExactlyElementsOf(board);
        }

        @Test
        void list_needsNoAdminRights() {
            when(statusRepository.findAllByOrderByPositionAsc()).thenReturn(List.of());

            assertThat(service.list()).isEmpty();
        }
    }

    @Nested
    class Creation {

        @Test
        void create_placesTheNewColumnBetweenTheLastCustomAndResolved() {
            when(statusRepository.existsByName("Waiting for parts")).thenReturn(false);
            when(statusRepository.findByKind(RESOLVED)).thenReturn(Optional.of(resolved));
            when(statusRepository.findByKindOrderByPositionAsc(CUSTOM)).thenReturn(List.of(onHold));
            when(statusRepository.save(any())).thenAnswer(call -> call.getArgument(0));

            TicketStatusDefinition created = service.create(admin, create("Waiting for parts", "#ff0000"));

            assertThat(created.getKind()).isEqualTo(CUSTOM);
            assertThat(created.getName()).isEqualTo("Waiting for parts");
            assertThat(created.getColor()).isEqualTo("#ff0000");
            assertThat(created.getPosition())
                    .isGreaterThan(onHold.getPosition())
                    .isLessThan(resolved.getPosition());
        }

        @Test
        void create_onABoardWithoutCustomStatuses_landsAfterTechRequired() {
            when(statusRepository.existsByName(any())).thenReturn(false);
            when(statusRepository.findByKind(RESOLVED)).thenReturn(Optional.of(resolved));
            when(statusRepository.findByKind(TECH_REQUIRED)).thenReturn(Optional.of(techRequired));
            when(statusRepository.findByKindOrderByPositionAsc(CUSTOM)).thenReturn(List.of());
            when(statusRepository.save(any())).thenAnswer(call -> call.getArgument(0));

            TicketStatusDefinition created = service.create(admin, create("Escalated", "#00ff00"));

            assertThat(created.getPosition())
                    .isGreaterThan(techRequired.getPosition())
                    .isLessThan(resolved.getPosition());
        }

        @Test
        void create_withATakenName_isRejected() {
            when(statusRepository.existsByName("On Hold")).thenReturn(true);

            assertThatThrownBy(() -> service.create(admin, create("On Hold", "#ff0000")))
                    .isInstanceOf(DuplicateTicketStatusNameException.class);

            verify(statusRepository, never()).save(any());
        }

        @Test
        void create_byNonAdmin_isRejectedBeforeAnyLookup() {
            assertThatThrownBy(() -> service.create(principal(ActorType.AGENT), create("Nope", "#ff0000")))
                    .isInstanceOf(IllegalStateException.class);

            verify(statusRepository, never()).save(any());
        }
    }

    @Nested
    class Renaming {

        @Test
        void update_renamesAndRecolorsACustomStatus() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.existsByName("Paused")).thenReturn(false);
            when(statusRepository.save(onHold)).thenReturn(onHold);

            TicketStatusDefinition updated = service.update(admin, update("st-hold", "Paused", "#123456"));

            assertThat(updated.getName()).isEqualTo("Paused");
            assertThat(updated.getColor()).isEqualTo("#123456");
        }

        @Test
        void update_withUnchangedValues_savesWithoutTouchingTheName() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.save(onHold)).thenReturn(onHold);

            service.update(admin, update("st-hold", "On Hold", onHold.getColor()));

            verify(statusRepository, never()).existsByName(any());
        }

        @Test
        void update_withNullFields_leavesTheStatusAsIs() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.save(onHold)).thenReturn(onHold);

            TicketStatusDefinition updated = service.update(admin, update("st-hold", null, null));

            assertThat(updated.getName()).isEqualTo("On Hold");
        }

        @Test
        void update_renamingASystemStatus_isRejected() {
            when(statusRepository.findById("st-resolved")).thenReturn(Optional.of(resolved));

            assertThatThrownBy(() -> service.update(admin, update("st-resolved", "Done", null)))
                    .isInstanceOf(SystemTicketStatusModificationException.class);
        }

        @Test
        void update_recoloringASystemStatus_isRejected() {
            when(statusRepository.findById("st-resolved")).thenReturn(Optional.of(resolved));

            assertThatThrownBy(() -> service.update(admin, update("st-resolved", null, "#ffffff")))
                    .isInstanceOf(SystemTicketStatusModificationException.class);
        }

        @Test
        void update_toANameAnotherStatusAlreadyHas_isRejected() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.existsByName("Resolved")).thenReturn(true);

            assertThatThrownBy(() -> service.update(admin, update("st-hold", "Resolved", null)))
                    .isInstanceOf(DuplicateTicketStatusNameException.class);
        }

        @Test
        void update_ofAnUnknownStatus_isRejected() {
            when(statusRepository.findById("st-ghost")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(admin, update("st-ghost", "Whatever", null)))
                    .isInstanceOf(TicketStatusNotFoundException.class);
        }
    }

    @Nested
    class Deletion {

        @Test
        void delete_anEmptyCustomStatus_removesItOutright() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(ticketRepository.countByStatusId("st-hold")).thenReturn(0L);

            assertThat(service.delete(admin, delete("st-hold", null))).isTrue();

            verify(statusRepository).delete(onHold);
            verify(ticketRepository, never()).reassignTicketsToStatus(anyString(), anyString(), any());
        }

        @Test
        void delete_aPopulatedStatus_movesItsTicketsToTheReplacement() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.findById("st-tech")).thenReturn(Optional.of(techRequired));
            when(ticketRepository.countByStatusId("st-hold")).thenReturn(7L);
            when(transitionPolicy.allowedKinds(CUSTOM)).thenReturn(Set.of(TECH_REQUIRED, RESOLVED));

            assertThat(service.delete(admin, delete("st-hold", "st-tech"))).isTrue();

            verify(ticketRepository).reassignTicketsToStatus("st-hold", "st-tech", TECH_REQUIRED);
            verify(statusRepository).delete(onHold);
        }

        @Test
        void delete_aPopulatedStatusWithoutAReplacement_isRejected() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(ticketRepository.countByStatusId("st-hold")).thenReturn(3L);

            assertThatThrownBy(() -> service.delete(admin, delete("st-hold", null)))
                    .isInstanceOf(TicketStatusInUseException.class);

            verify(statusRepository, never()).delete(any());
        }

        @Test
        void delete_withItselfAsReplacement_isRejected() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(ticketRepository.countByStatusId("st-hold")).thenReturn(3L);

            assertThatThrownBy(() -> service.delete(admin, delete("st-hold", "st-hold")))
                    .isInstanceOf(InvalidTicketStatusReplacementException.class);

            verify(statusRepository, never()).delete(any());
        }

        @Test
        void delete_intoAStatusTheTransitionPolicyForbids_isRejected() {
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.findById("st-archived")).thenReturn(Optional.of(archived));
            when(ticketRepository.countByStatusId("st-hold")).thenReturn(3L);
            when(transitionPolicy.allowedKinds(CUSTOM)).thenReturn(Set.of(TECH_REQUIRED, RESOLVED));

            assertThatThrownBy(() -> service.delete(admin, delete("st-hold", "st-archived")))
                    .isInstanceOf(InvalidTicketStatusReplacementException.class);

            verify(ticketRepository, never()).reassignTicketsToStatus(anyString(), anyString(), any());
            verify(statusRepository, never()).delete(any());
        }

        @Test
        void delete_ofASystemStatus_isRejected() {
            when(statusRepository.findById("st-resolved")).thenReturn(Optional.of(resolved));

            assertThatThrownBy(() -> service.delete(admin, delete("st-resolved", null)))
                    .isInstanceOf(SystemTicketStatusModificationException.class);

            verify(ticketRepository, never()).countByStatusId(any());
        }
    }

    @Nested
    class Reordering {

        @Test
        void reorder_betweenTwoCustomStatuses_landsInTheGap() {
            TicketStatusDefinition waiting = status("st-wait", CUSTOM, "Waiting", LexoRank.parse(onHold.getPosition()).genNext());
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.findById("st-wait")).thenReturn(Optional.of(waiting));
            when(statusRepository.save(moving)).thenReturn(moving);

            TicketStatusDefinition reordered = service.reorder(admin, reorder("st-move", "st-hold", "st-wait"));

            assertThat(reordered.getPosition())
                    .isGreaterThan(onHold.getPosition())
                    .isLessThan(waiting.getPosition());
        }

        @Test
        void reorder_afterTheLastCustomStatus_stopsShortOfResolved() {
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.findByKindOrderByPositionAsc(CUSTOM)).thenReturn(List.of(onHold, moving));
            when(statusRepository.findByKind(RESOLVED)).thenReturn(Optional.of(resolved));
            when(statusRepository.save(moving)).thenReturn(moving);

            TicketStatusDefinition reordered = service.reorder(admin, reorder("st-move", "st-hold", null));

            assertThat(reordered.getPosition())
                    .isGreaterThan(onHold.getPosition())
                    .isLessThan(resolved.getPosition());
        }

        @Test
        void reorder_beforeTheFirstCustomStatus_stopsShortOfTechRequired() {
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genNext().genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));
            when(statusRepository.findById("st-hold")).thenReturn(Optional.of(onHold));
            when(statusRepository.findByKindOrderByPositionAsc(CUSTOM)).thenReturn(List.of(onHold, moving));
            when(statusRepository.findByKind(TECH_REQUIRED)).thenReturn(Optional.of(techRequired));
            when(statusRepository.save(moving)).thenReturn(moving);

            TicketStatusDefinition reordered = service.reorder(admin, reorder("st-move", null, "st-hold"));

            assertThat(reordered.getPosition())
                    .isGreaterThan(techRequired.getPosition())
                    .isLessThan(onHold.getPosition());
        }

        @Test
        void reorder_withoutAnyNeighbour_isRejected() {
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));

            assertThatThrownBy(() -> service.reorder(admin, reorder("st-move", null, null)))
                    .isInstanceOf(InvalidTicketStatusReorderException.class);

            verify(statusRepository, never()).save(any());
        }

        @Test
        void reorder_relativeToItself_isRejected() {
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));

            assertThatThrownBy(() -> service.reorder(admin, reorder("st-move", "st-move", null)))
                    .isInstanceOf(InvalidTicketStatusReorderException.class);

            verify(statusRepository, never()).save(any());
        }

        @Test
        void reorder_nextToASystemStatus_isRejected() {
            TicketStatusDefinition moving = status("st-move", CUSTOM, "Moving", MIDDLE.genPrev());
            when(statusRepository.findById("st-move")).thenReturn(Optional.of(moving));
            when(statusRepository.findById("st-resolved")).thenReturn(Optional.of(resolved));

            assertThatThrownBy(() -> service.reorder(admin, reorder("st-move", "st-resolved", null)))
                    .isInstanceOf(InvalidTicketStatusReorderException.class);

            verify(statusRepository, never()).save(any());
        }

        @Test
        void reorder_ofASystemStatus_isRejected() {
            when(statusRepository.findById("st-resolved")).thenReturn(Optional.of(resolved));

            assertThatThrownBy(() -> service.reorder(admin, reorder("st-resolved", "st-hold", null)))
                    .isInstanceOf(SystemTicketStatusModificationException.class);

            verify(statusRepository, never()).save(any());
        }
    }

    @Test
    void create_whenTheResolvedSystemStatusIsMissing_failsLoudly() {
        lenient().when(statusRepository.existsByName(any())).thenReturn(false);
        when(statusRepository.findByKind(RESOLVED)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(admin, create("Anything", "#ffffff")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESOLVED");
    }

    private static TicketStatusDefinition status(String id, TicketStatusKind kind, String name, LexoRank rank) {
        return TicketStatusDefinition.builder()
                .id(id)
                .kind(kind)
                .name(name)
                .color("#cccccc")
                .position(rank.format())
                .build();
    }

    private static CreateTicketStatusInput create(String name, String color) {
        return CreateTicketStatusInput.builder().name(name).color(color).build();
    }

    private static UpdateTicketStatusInput update(String id, String name, String color) {
        return UpdateTicketStatusInput.builder().id(id).name(name).color(color).build();
    }

    private static DeleteTicketStatusInput delete(String id, String replacementId) {
        return DeleteTicketStatusInput.builder().id(id).replacementStatusId(replacementId).build();
    }

    private static ReorderTicketStatusInput reorder(String id, String afterId, String beforeId) {
        return ReorderTicketStatusInput.builder().id(id).afterStatusId(afterId).beforeStatusId(beforeId).build();
    }

    private static AuthPrincipal principal(ActorType actorType) {
        return AuthPrincipal.builder().id("actor-1").actorType(actorType).build();
    }
}
