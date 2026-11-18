package com.openframe.client.service.agentregistration;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static com.openframe.data.document.tag.TagEntityType.DEVICE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationTagResolverTest {

    private static final String KEY = "site";
    private static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    @Mock private TagRepository tagRepository;

    @Captor private ArgumentCaptor<Tag> tagCaptor;

    @InjectMocks private RegistrationTagResolver resolver;

    private Tag existing;

    @BeforeEach
    void setUp() {
        existing = Tag.builder().id("tag-1").key(KEY).entityType(DEVICE).values(new ArrayList<>(List.of("CHICAGO"))).build();
    }

    @Test
    void resolve_noTagWithTheKey_deviceTagCreatedWithTheValues() {
        // setup
        Tag saved = Tag.builder().id("tag-2").key(KEY).build();
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(null);
        when(tagRepository.save(tagCaptor.capture())).thenReturn(saved);

        // execution
        Tag result = resolver.resolve(KEY, List.of("BOSTON"), NOW);

        // verifications
        assertThat(result).isSameAs(saved);
        assertThat(tagCaptor.getValue())
                .extracting(Tag::getKey, Tag::getEntityType, Tag::getValues, Tag::getCreatedAt)
                .containsExactly(KEY, DEVICE, List.of("BOSTON"), NOW);
    }

    @Test
    void resolve_newValue_appendedToTheExistingTag() {
        // setup
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(existing);

        // execution
        Tag result = resolver.resolve(KEY, List.of("BOSTON"), NOW);

        // verifications
        verify(tagRepository).save(existing);
        assertThat(result).isSameAs(existing);
        assertThat(existing.getValues()).containsExactly("CHICAGO", "BOSTON");
    }

    @Test
    void resolve_knownValuesOnly_existingTagNotSaved() {
        // setup
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(existing);

        // execution
        Tag result = resolver.resolve(KEY, List.of("CHICAGO"), NOW);

        // verifications
        verify(tagRepository, never()).save(any(Tag.class));
        assertThat(result).isSameAs(existing);
    }

    @Test
    void resolve_noValues_existingTagNotSaved() {
        // setup
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(existing);

        // execution
        Tag result = resolver.resolve(KEY, List.of(), NOW);

        // verifications
        verify(tagRepository, never()).save(any(Tag.class));
        assertThat(result).isSameAs(existing);
    }

    @Test
    void resolve_nullValues_existingTagNotSaved() {
        // setup
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(existing);

        // execution
        Tag result = resolver.resolve(KEY, null, NOW);

        // verifications
        verify(tagRepository, never()).save(any(Tag.class));
        assertThat(result).isSameAs(existing);
    }

    @Test
    void resolve_existingTagWithoutValues_valuesSet() {
        // setup
        existing.setValues(null);
        when(tagRepository.findByKeyAndEntityType(KEY, DEVICE)).thenReturn(existing);

        // execution
        resolver.resolve(KEY, List.of("BOSTON"), NOW);

        // verifications
        verify(tagRepository).save(existing);
        assertThat(existing.getValues()).containsExactly("BOSTON");
    }

    @Test
    void resolve_annotation_retriedOnAStaleCopy() throws NoSuchMethodException {
        // setup
        Method resolve = RegistrationTagResolver.class.getMethod("resolve", String.class, List.class, Instant.class);

        // execution
        boolean retried = resolve.isAnnotationPresent(RetryOnOptimisticLockingFailure.class);

        // verifications
        assertThat(retried).isTrue();
    }
}
