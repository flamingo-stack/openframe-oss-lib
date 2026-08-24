package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.repository.ticket.TicketNoteRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
public class TicketNoteService {

    private final TicketNoteRepository noteRepository;
    private final TicketRepository ticketRepository;

    @Transactional
    public TicketNote addNote(AuthPrincipal principal, @NotBlank String ticketId, @NotBlank String content) {
        validateAdminAccess(principal);
        validateTicketExists(ticketId);
        log.info("Adding note to ticket {} by: {}", ticketId, principal.getDisplayName());
        TicketNote note = TicketNote.builder()
                .ticketId(ticketId)
                .content(content)
                .authorId(principal.getId())
                .build();
        return noteRepository.save(note);
    }

    @Transactional
    public TicketNote updateNote(AuthPrincipal principal, @NotBlank String noteId, @NotBlank String content) {
        validateAdminAccess(principal);
        log.info("Updating note {} by: {}", noteId, principal.getDisplayName());
        TicketNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found: " + noteId));
        if (!note.getAuthorId().equals(principal.getId())) {
            throw new IllegalStateException("Only the author can update this note");
        }
        note.setContent(content);
        return noteRepository.save(note);
    }

    @Transactional
    public void deleteNote(AuthPrincipal principal, @NotBlank String noteId) {
        validateAdminAccess(principal);
        log.info("Deleting note {} by: {}", noteId, principal.getDisplayName());
        TicketNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found: " + noteId));
        if (!note.getAuthorId().equals(principal.getId())) {
            throw new IllegalStateException("Only the author can delete this note");
        }
        noteRepository.delete(note);
        log.info("Note deleted: {}", noteId);
    }

    public List<List<TicketNote>> getNotesByTicketIds(List<String> ticketIds) {
        log.debug("Batch loading notes for {} tickets", ticketIds.size());
        List<TicketNote> notes = noteRepository.findByTicketIdIn(ticketIds);
        Map<String, List<TicketNote>> notesByTicketId = notes.stream()
                .collect(Collectors.groupingBy(TicketNote::getTicketId));
        return ticketIds.stream()
                .map(ticketId -> notesByTicketId.getOrDefault(ticketId, List.of()))
                .toList();
    }

    private void validateTicketExists(String ticketId) {
        if (!ticketRepository.existsById(ticketId)) {
            throw new IllegalArgumentException("Ticket not found: " + ticketId);
        }
    }
}
