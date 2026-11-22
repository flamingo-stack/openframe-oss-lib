package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.RegistrationSessionLogin;
import com.openframe.authz.service.processor.PasswordSignupProcessor;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@SpringJUnitConfig(TenantRegistrationControllerTest.ValidationConfiguration.class)
@TestPropertySource(properties = "openframe.tenancy.base-domain=openframe.ai")
class TenantRegistrationControllerTest {

    @Mock
    private TenantRegistrationService registrationService;
    @Mock
    private UserService userService;
    @Mock
    private RegistrationSessionLogin registrationSessionLogin;
    @Mock
    private ObjectProvider<PasswordSignupProcessor> passwordSignupProcessor;
    @Mock
    private PasswordSignupProcessor protectedSignup;
    @InjectMocks
    private TenantRegistrationController controller;
    @Autowired
    private LocalValidatorFactoryBean validator;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(controller).setValidator(validator).build();
    }

    @Test
    void shouldAcknowledgeProtectedSignupWithoutReturningTenantDataOrStartingASession() throws Exception {
        TenantRegistrationRequest request = registration();
        String body = objectMapper.writeValueAsString(request);
        when(passwordSignupProcessor.getIfAvailable()).thenReturn(protectedSignup);

        mvc.perform(post("/oauth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""))
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull());

        verify(protectedSignup).acceptPasswordSignup(request);
        verifyNoInteractions(registrationService, userService, registrationSessionLogin);
    }

    @Test
    void shouldKeepTheSelfHostedRegistrationResponseAndOwnerSignIn() throws Exception {
        TenantRegistrationRequest request = registration();
        String body = objectMapper.writeValueAsString(request);
        Tenant workspace = new Tenant();
        workspace.setId("workspace-1");
        workspace.setOwnerId("owner-1");
        AuthUser owner = new AuthUser();
        owner.setId("owner-1");
        when(registrationService.registerTenant(request)).thenReturn(workspace);
        when(userService.findActiveById("owner-1")).thenReturn(Optional.of(owner));

        mvc.perform(post("/oauth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("workspace-1"));

        verify(registrationSessionLogin).signIn(eq(owner), any(HttpServletRequest.class), any(HttpServletResponse.class));
    }

    private TenantRegistrationRequest registration() {
        return TenantRegistrationRequest.builder()
                .firstName("Ada")
                .lastName("Lovelace")
                .email("ada@example.com")
                .password("ExamplePass1!")
                .tenantName("Example Workspace")
                .tenantDomain("example-workspace.openframe.ai")
                .build();
    }

    @Configuration(proxyBeanMethods = false)
    static class ValidationConfiguration {

        @Bean
        LocalValidatorFactoryBean validator() {
            return new LocalValidatorFactoryBean();
        }
    }
}
