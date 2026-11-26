package com.openframe.api.service.user;

import com.openframe.api.exception.OperationNotAllowedException;
import com.openframe.api.exception.OwnerDeleteNotAllowedException;
import com.openframe.api.exception.UserNotFoundException;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.USER_DELETE;
import static com.openframe.data.document.audit.AuditAction.USER_OWNERSHIP_TRANSFER;
import static com.openframe.data.document.audit.AuditActorType.USER;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.user.UserRole.ADMIN;
import static com.openframe.data.document.user.UserRole.OWNER;
import static com.openframe.data.document.user.UserStatus.ACTIVE;
import static com.openframe.data.document.user.UserStatus.DELETED;
import static com.openframe.data.document.user.UserStatus.SELF_DELETED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final AuditActor CALLER =
            new AuditActor(USER, "u-1", "Jane Doe", "jane@acme.io", List.of("ADMIN"), "tenant-1", null, null);

    @Mock private UserRepository userRepository;
    @Mock private SsoIdentityRepository ssoIdentityRepository;
    @Mock private UserProcessor userProcessor;
    @Mock private EmailService emailService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private UserService userService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<AuditedWork<Object, RuntimeException>> contextWorkCaptor;
    @Captor private ArgumentCaptor<AuditedWork<Object, RuntimeException>> workCaptor;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    @Test
    void deleteUser_storesTheEventOnTheDeletedUser() {
        audited().deleteUser("u-2");

        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        assertThat(callCaptor.getValue())
                .returns(USER_DELETE, AuditCall::action)
                .returns("u-2", deleteCall -> deleteCall.targetIdBeforeCall().get());
    }

    @Test
    void deleteUser_activeUser_marksItDeleted() {
        User user = user("u-2", ADMIN);
        when(userRepository.findById("u-2")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        userService.deleteUser("u-2");

        assertThat(user.getStatus()).isEqualTo(DELETED);
    }

    @Test
    void deleteUser_userNoLongerActive_savesNothing() {
        User user = user("u-2", ADMIN);
        user.setStatus(DELETED);
        when(userRepository.findById("u-2")).thenReturn(Optional.of(user));

        userService.deleteUser("u-2");

        verify(userRepository, never()).save(any());
    }

    @Test
    void deleteUser_owner_isRefused() {
        when(userRepository.findById("u-2")).thenReturn(Optional.of(user("u-2", OWNER)));

        assertThatThrownBy(() -> userService.deleteUser("u-2"))
                .isInstanceOf(OwnerDeleteNotAllowedException.class)
                .hasMessage("Owner accounts can’t be deleted; transfer ownership first");
    }

    @Test
    void deleteUser_unknownUser_isRefused() {
        when(userRepository.findById("u-2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.deleteUser("u-2"))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessage("User not found: u-2");
    }

    @Test
    void deleteOwnAccount_activeAccount_storesOnlyTheSelfDeletedStatus() {
        ownActiveAccount();
        AuditCall call = ownAccountDeleteCall();

        Object deleted = workCaptor.getValue().run();

        assertThat(call.storeIf().test(deleted)).isTrue();
        assertThat(call.detailsFromResult().apply(deleted)).containsExactlyEntriesOf(Map.of("status", "SELF_DELETED"));
        assertThat(call.compare()).isFalse();
    }

    @Test
    void deleteOwnAccount_accountNoLongerActive_storesNoEvent() {
        User user = user("u-1", ADMIN);
        user.setStatus(SELF_DELETED);
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user));
        AuditCall call = ownAccountDeleteCall();

        Object deleted = workCaptor.getValue().run();

        assertThat(call.storeIf().test(deleted)).isFalse();
    }

    @Test
    void deleteOwnAccount_owner_isRefusedInsideTheAuditedWork() {
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user("u-1", OWNER)));
        ownAccountDeleteCall();

        assertThatThrownBy(workCaptor.getValue()::run)
                .isInstanceOf(OwnerDeleteNotAllowedException.class)
                .hasMessage("Owner accounts can’t be deleted; transfer ownership first");
    }

    @Test
    void deleteOwnAccount_refused_storesNoDeletedStatus() {
        AuditCall call = ownAccountDeleteCall();

        assertThat(call.detailsFromResult().apply(null)).isEmpty();
    }

    @Test
    void transferOwnership_storesTheEventOnTheNewOwner() {
        audited().transferOwnership("u-2", "u-1");

        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        assertThat(callCaptor.getValue())
                .returns(USER_OWNERSHIP_TRANSFER, AuditCall::action)
                .returns("u-2", transferCall -> transferCall.targetIdBeforeCall().get());
    }

    @Test
    void transferOwnership_toAnotherActiveUser_recordsTheOldOwnersRoleChange() {
        transferableAdmin();

        userService.transferOwnership("u-2", "u-1");

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue())
                .returns(USER_OWNERSHIP_TRANSFER, AuditEntry::getAction)
                .returns(SUCCESS, AuditEntry::getOutcome)
                .returns("u-1", AuditEntry::getTargetId)
                .returns(Map.of("roles", new AuditChange(List.of("OWNER"), List.of("ADMIN"))), AuditEntry::getChanges);
    }

    @Test
    void transferOwnership_callerNotOwner_isRefused() {
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user("u-1", ADMIN)));

        assertThatThrownBy(() -> userService.transferOwnership("u-2", "u-1"))
                .isInstanceOf(OperationNotAllowedException.class)
                .hasMessage("Only the owner can transfer ownership");
    }

    @Test
    void transferOwnership_unknownCaller_isRefused() {
        when(userRepository.findById("u-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.transferOwnership("u-2", "u-1"))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessage("User not found: u-1");
    }

    @Test
    void transferOwnership_unknownNewOwner_isRefused() {
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user("u-1", OWNER)));
        when(userRepository.findById("u-2")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.transferOwnership("u-2", "u-1"))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessage("User not found: u-2");
    }

    @Test
    void transferOwnership_newOwnerNotActive_isRefused() {
        User deleted = user("u-2", ADMIN);
        deleted.setStatus(DELETED);
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user("u-1", OWNER)));
        when(userRepository.findById("u-2")).thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> userService.transferOwnership("u-2", "u-1"))
                .isInstanceOf(OperationNotAllowedException.class)
                .hasMessage("Ownership can only be transferred to an active user");
    }

    private User ownActiveAccount() {
        User user = user("u-1", ADMIN);
        user.setEmail("jane@acme.io");
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        return user;
    }

    private AuditCall ownAccountDeleteCall() {
        when(auditRecorder.context()).thenReturn(new AuditContext(CALLER, null, null));
        userService.deleteOwnAccount("u-1");
        verify(auditRecorder).runInContext(any(), contextWorkCaptor.capture());
        contextWorkCaptor.getValue().run();
        verify(auditedMethodRunner).run(callCaptor.capture(), workCaptor.capture());
        return callCaptor.getValue();
    }

    private UserService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(userService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private User transferableAdmin() {
        User admin = user("u-2", ADMIN);
        admin.setEmail("john@acme.io");
        when(userRepository.findById("u-1")).thenReturn(Optional.of(user("u-1", OWNER)));
        when(userRepository.findById("u-2")).thenReturn(Optional.of(admin));
        when(userRepository.save(any(User.class))).thenAnswer(returnsFirstArg());
        return admin;
    }

    private static User user(String id, UserRole role) {
        return User.builder().id(id).status(ACTIVE).roles(List.of(role)).build();
    }
}
