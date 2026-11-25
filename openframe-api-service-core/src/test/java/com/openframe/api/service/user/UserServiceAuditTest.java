package com.openframe.api.service.user;

import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UserServiceAuditTest {

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private UserService userService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void updateUser_refused_keepsTheAskedNamesInTheDetails() {
        UpdateUserRequest request = new UpdateUserRequest();
        request.setFirstName("Jane");
        request.setLastName("Doe");

        audited().updateUser("u-1", request);

        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        assertThat(callCaptor.getValue().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(Map.of("firstName", "Jane", "lastName", "Doe"));
    }

    private UserService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(userService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }
}
