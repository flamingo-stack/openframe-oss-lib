package com.openframe.api.controller;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUpload;
import com.openframe.api.service.KnowledgeBaseImageService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseImageControllerTest {

    private static final String UPLOAD_REQUEST_JSON = """
            {"fileName": "screenshot.png", "contentType": "image/png", "fileSize": 1234}
            """;

    private MockMvc mockMvc;

    @Mock
    private KnowledgeBaseImageService imageService;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.standaloneSetup(new KnowledgeBaseImageController(imageService))
                .setCustomArgumentResolvers(new StubAuthPrincipalResolver())
                .setControllerAdvice(new BaseGlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST returns 201 with the permanent url, signed upload url and required headers")
    void createUpload_returnsContract() throws Exception {
        when(imageService.createUpload("user-1", "screenshot.png", "image/png", 1234L))
                .thenReturn(KnowledgeBaseImageUpload.builder()
                        .image(KnowledgeBaseImage.builder().id("img-1").build())
                        .uploadUrl("https://signed-upload")
                        .contentLengthRange("0,10485760")
                        .build());

        mockMvc.perform(post("/knowledge-base/images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(UPLOAD_REQUEST_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url").value("/knowledge-base/images/img-1"))
                .andExpect(jsonPath("$.uploadUrl").value("https://signed-upload"))
                .andExpect(jsonPath("$.uploadHeaders['x-goog-content-length-range']").value("0,10485760"));
    }

    @Test
    @DisplayName("POST without a file name is rejected with 400 before reaching the service")
    void createUpload_missingFileName() throws Exception {
        mockMvc.perform(post("/knowledge-base/images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"contentType": "image/png", "fileSize": 1234}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(imageService);
    }

    @Test
    @DisplayName("POST surfaces service validation failures as 400 JSON")
    void createUpload_serviceRejects() throws Exception {
        when(imageService.createUpload(any(), any(), any(), any()))
                .thenThrow(new BadRequestException("Unsupported image type: image/svg+xml"));

        mockMvc.perform(post("/knowledge-base/images")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(UPLOAD_REQUEST_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Unsupported image type: image/svg+xml"));
    }

    @Test
    @DisplayName("GET redirects to a fresh signed url and caches the redirect just under its lifetime")
    void getImage_redirects() throws Exception {
        when(imageService.generateDownloadUrl("img-1")).thenReturn("https://signed-download");
        when(imageService.getDownloadUrlExpirationMinutes()).thenReturn(1440);

        mockMvc.perform(get("/knowledge-base/images/img-1"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://signed-download"))
                // one minute less than the signature lifetime: 1439 min
                .andExpect(header().string("Cache-Control", "max-age=86340, private"));
    }

    @Test
    @DisplayName("GET returns 404 for an unknown image id")
    void getImage_unknownId() throws Exception {
        when(imageService.generateDownloadUrl("missing")).thenThrow(new NotFoundException("Image not found: missing"));

        mockMvc.perform(get("/knowledge-base/images/missing"))
                .andExpect(status().isNotFound());
    }

    /** Supplies a fixed {@link AuthPrincipal} for {@code @AuthenticationPrincipal} parameters. */
    private static class StubAuthPrincipalResolver implements HandlerMethodArgumentResolver {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return AuthPrincipal.class.isAssignableFrom(parameter.getParameterType());
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                      NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return AuthPrincipal.builder().id("user-1").build();
        }
    }
}
