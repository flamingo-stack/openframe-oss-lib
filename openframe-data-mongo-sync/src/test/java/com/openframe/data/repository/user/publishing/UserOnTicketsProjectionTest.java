package com.openframe.data.repository.user.publishing;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import org.junit.jupiter.api.Test;
import org.springframework.data.mapping.PropertyHandler;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class UserOnTicketsProjectionTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final TicketProjectionRepository ticketProjectionRepository = mock(TicketProjectionRepository.class);
    private final UserOnTicketsProjection projection = new UserOnTicketsProjection(ticketProjectionRepository,
            userRepository);

    @Test
    void anEvent_setsTheFullNameOnTheTicketsThatNameTheUserInItsTenant() {
        // execution
        projection.apply(buildRecord("tenant-a", "user-1", " Ada ", "Lovelace"));

        // verifications
        verify(ticketProjectionRepository).updateUserNames("tenant-a", "user-1", "Ada Lovelace");
    }

    @Test
    void theChanges_areCounted_andWrittenInBatches() {
        // setup
        PublishedRecord<UserEvent> record = buildRecord("tenant-a", "user-1", "Ada", "Lovelace");
        when(ticketProjectionRepository.countTicketsToUpdateUserName("tenant-a", "user-1", "Ada Lovelace", 5000)).thenReturn(5000L);
        when(ticketProjectionRepository.updateUserNamesBatch("tenant-a", "user-1", "Ada Lovelace", "t5", 1000)).thenReturn("t9");

        // execution and verifications
        assertThat(projection.countChanges(record, 5000)).isEqualTo(5000L);
        assertThat(projection.applyBatch(record, "t5", 1000)).isEqualTo("t9");
    }

    @Test
    void anOldAssigneeName_andAnOldResolverName_areMismatches_butAGoneUserKeepsItsCopy() {
        // setup
        when(userRepository.findByTenantIdInAndIdIn(Set.of("tenant-a"), Set.of("user-1", "user-gone")))
                .thenReturn(List.of(buildUser("tenant-a", "user-1", "Ada", "Lovelace")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                buildTicket("t1", "tenant-a", "user-1", "Ada Lovelace", "user-1", "Ada Lovelace"),
                buildTicket("t2", "tenant-a", "user-1", "Ada", null, null),
                buildTicket("t3", "tenant-a", null, null, "user-1", "Ada"),
                buildTicket("t4", "tenant-a", "user-gone", "Gone", null, null)));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t2", "t3");
        assertThat(result.getMismatches()).extracting(Mismatch::getSourceId).containsExactly("user-1", "user-1");
    }

    @Test
    void eachTicket_isMatchedWithTheUserOfItsOwnTenant() {
        // setup
        when(userRepository.findByTenantIdInAndIdIn(Set.of("tenant-a", "tenant-b"), Set.of("user-1")))
                .thenReturn(List.of(buildUser("tenant-a", "user-1", "Ada", null), buildUser("tenant-b", "user-1", "Grace", null)));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                buildTicket("t1", "tenant-a", "user-1", "Ada", null, null),
                buildTicket("t2", "tenant-b", "user-1", "Ada", null, null)));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t2");
    }

    // An assignment may have stored the email for a user with no name; the projection must not blank it.
    @Test
    void aUserWithoutAName_leavesTheTicketCopiesAlone() {
        // setup
        PublishedRecord<UserEvent> record = buildRecord("tenant-a", "user-1", " ", null);

        // execution
        projection.apply(record);
        long changes = projection.countChanges(record, 5000);
        String lastId = projection.applyBatch(record, null, 1000);

        // verifications
        assertThat(changes).isZero();
        assertThat(lastId).isNull();
        verifyNoInteractions(ticketProjectionRepository);
    }

    @Test
    void theEmailCopyOfAUserWithoutAName_isNoMismatch() {
        // setup
        when(userRepository.findByTenantIdInAndIdIn(Set.of("tenant-a"), Set.of("user-1")))
                .thenReturn(List.of(buildUser("tenant-a", "user-1", null, " ")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                buildTicket("t1", "tenant-a", "user-1", "ada@example.com", null, null)));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
    }

    @Test
    void ticketsWithoutAssigneeOrResolver_areSkipped_withoutAQuery() {
        // execution
        ReconciliationResult result = projection.reconcile(List.of(buildTicket("t1", "tenant-a", null, null, null, null)));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
        verify(userRepository, never()).findByTenantIdInAndIdIn(any(), any());
    }

    @Test
    void everyViewField_isATicketProperty_storedUnderTheSameName() {
        // setup
        MongoMappingContext mappingContext = new MongoMappingContext();
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MongoPersistentEntity<?> ticket = mappingContext.getRequiredPersistentEntity(Ticket.class);
        MongoPersistentEntity<?> view = mappingContext.getRequiredPersistentEntity(TicketUserView.class);

        // execution and verifications
        assertThat(projection.name()).isEqualTo("user-on-tickets");
        view.doWithProperties((PropertyHandler<MongoPersistentProperty>) viewProperty -> {
            String name = viewProperty.getName();
            MongoPersistentProperty ticketProperty = ticket.getPersistentProperty(name);
            assertThat(ticketProperty).as(name).isNotNull();
            assertThat(viewProperty.getFieldName()).isEqualTo(ticketProperty.getFieldName());
        });
    }

    private static TicketUserView buildTicket(String id, String tenantId, String assignedTo, String assignedName,
                                              String resolvedById, String resolvedByName) {
        return new TicketUserView(id, tenantId, assignedTo, assignedName, resolvedById, resolvedByName);
    }

    private static User buildUser(String tenantId, String id, String firstName, String lastName) {
        return User.builder().id(id).tenantId(tenantId).firstName(firstName).lastName(lastName).build();
    }

    private static PublishedRecord<UserEvent> buildRecord(String tenantId, String userId, String firstName, String lastName) {
        UserEvent event = UserEvent.builder().userId(userId).firstName(firstName).lastName(lastName).build();
        return PublishedRecord.<UserEvent>builder().tenantId(tenantId).version(4L).schemaVersion(1).event(event).build();
    }
}
