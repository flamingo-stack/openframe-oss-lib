package com.openframe.api.service;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.tag.TagEntityType.KNOWLEDGE_ARTICLE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagServiceTest {

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;

    private TagService tagService;

    private final Tag newTag = Tag.builder()
            .id("tag-1")
            .key("NewTag")
            .entityType(KNOWLEDGE_ARTICLE)
            .build();

    @BeforeEach
    void setUp() {
        tagService = new TagService(tagRepository, tagAssignmentRepository);
    }

    @Test
    void createTagReturnsExactMatchWithoutSaving() {
        when(tagRepository.findByKeyAndEntityType("NewTag", KNOWLEDGE_ARTICLE)).thenReturn(newTag);

        Tag result = tagService.createTag("NewTag", KNOWLEDGE_ARTICLE, null, null);

        assertThat(result).isSameAs(newTag);
        verify(tagRepository, never()).save(any());
    }

    @Test
    void createTagReturnsCaseVariantMatchWithoutSaving() {
        when(tagRepository.findByKeyAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(null);
        when(tagRepository.findByKeyIgnoreCaseAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(List.of(newTag));

        Tag result = tagService.createTag("NEWTAG", KNOWLEDGE_ARTICLE, null, null);

        assertThat(result).isSameAs(newTag);
        verify(tagRepository, never()).save(any());
    }

    @Test
    void createTagSavesWhenNoCaseVariantExists() {
        when(tagRepository.findByKeyAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(null);
        when(tagRepository.findByKeyIgnoreCaseAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(List.of());
        when(tagRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Tag result = tagService.createTag("Printers", KNOWLEDGE_ARTICLE, "desc", "#FF8800");

        assertThat(result.getKey()).isEqualTo("Printers");
        assertThat(result.getEntityType()).isEqualTo(KNOWLEDGE_ARTICLE);
        verify(tagRepository).save(any());
    }

    @Test
    void createTagPrefersExactMatchOverCaseVariants() {
        Tag legacyDup = Tag.builder().id("tag-2").key("NEWTAG").entityType(KNOWLEDGE_ARTICLE).build();
        when(tagRepository.findByKeyAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(legacyDup);

        Tag result = tagService.createTag("NEWTAG", KNOWLEDGE_ARTICLE, null, null);

        assertThat(result).isSameAs(legacyDup);
        verify(tagRepository, never()).findByKeyIgnoreCaseAndEntityType(any(), any());
        verify(tagRepository, never()).save(any());
    }

    @Test
    void updateTagRejectsRenameCollidingWithCaseVariantOfAnotherTag() {
        Tag other = Tag.builder().id("tag-2").key("Printers").entityType(KNOWLEDGE_ARTICLE).build();
        when(tagRepository.findById("tag-2")).thenReturn(Optional.of(other));
        when(tagRepository.existsByKeyIgnoreCaseAndEntityTypeAndIdNot("NEWTAG", KNOWLEDGE_ARTICLE, "tag-2"))
                .thenReturn(true);

        assertThatThrownBy(() -> tagService.updateTag("tag-2", "NEWTAG", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NEWTAG");
        verify(tagRepository, never()).save(any());
    }

    @Test
    void updateTagAllowsChangingCaseOfOwnKey() {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(newTag));
        when(tagRepository.existsByKeyIgnoreCaseAndEntityTypeAndIdNot("NEWTAG", KNOWLEDGE_ARTICLE, "tag-1"))
                .thenReturn(false);
        when(tagRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Tag result = tagService.updateTag("tag-1", "NEWTAG", null, null);

        assertThat(result.getKey()).isEqualTo("NEWTAG");
        verify(tagRepository).save(newTag);
    }
}
