package com.openframe.api.service.ticket;

import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketTagServicePagingTest {

    private static final int LIMIT = 51;

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private TicketRepository ticketRepository;

    @InjectMocks private TicketTagService service;

    private final AuthPrincipal admin = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Test
    void getTagsPage_noCursor_readsTheFirstTicketTagsOldestFirst() {
        Tag tag = Tag.builder().id("tag-1").key("vip").entityType(TagEntityType.TICKET).build();
        when(tagRepository.findByEntityTypeOrderByIdAsc(TagEntityType.TICKET, Limit.of(LIMIT))).thenReturn(List.of(tag));

        List<Tag> page = service.getTagsPage(admin, null, LIMIT);

        assertThat(page).containsExactly(tag);
    }

    @Test
    void getTagsPage_cursorGiven_readsTheTicketTagsAfterThatTag() {
        Tag tag = Tag.builder().id("tag-2").key("urgent").entityType(TagEntityType.TICKET).build();
        when(tagRepository.findByEntityTypeAndIdGreaterThanOrderByIdAsc(TagEntityType.TICKET, "tag-1", Limit.of(LIMIT)))
                .thenReturn(List.of(tag));

        List<Tag> page = service.getTagsPage(admin, "tag-1", LIMIT);

        assertThat(page).containsExactly(tag);
    }

    @Test
    void getTagsPage_notAnAdmin_isRefusedBeforeAnyRead() {
        AuthPrincipal agent = AuthPrincipal.builder().id("agent-1").actorType(ActorType.AGENT).build();

        assertThatThrownBy(() -> service.getTagsPage(agent, null, LIMIT)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(tagRepository);
    }
}
