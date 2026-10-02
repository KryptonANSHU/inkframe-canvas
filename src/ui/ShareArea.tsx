import { Link, LogOut, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconTrigger, Popover, StatusBadge } from '@inkframe/design';
import type { CollabSession } from '../collab/session';
import type { CollabStatus } from '../core/collabState';
import { RELAY_URL, newRoomName, roomInLink, setRoomInLink } from './collabLink';
import { useEditor, useEditorState } from './EditorContext';
import { notify } from './notifications';
import { PeopleList } from './PeopleList';
import styles from './ShareArea.module.css';

const STATUS: Readonly<Record<CollabStatus, { tone: 'ok' | 'busy' | 'off'; label: string }>> = {
  connecting: { tone: 'busy', label: 'Connecting…' },
  connected: { tone: 'ok', label: 'Connected' },
  reconnecting: { tone: 'busy', label: 'Reconnecting…' },
  offline: { tone: 'off', label: 'Offline' },
};

/**
 * Drawing together: start a room from this drawing and share its link, or join the
 * room in the page's link. The collaboration code (Yjs) loads only when a room starts.
 */
export function ShareArea() {
  const editor = useEditor();
  // Room and status only: peers' cursors change many times a second.
  const collab = useEditorState((state) =>
    state.collab === null ? null : { room: state.collab.room, status: state.collab.status },
  );
  const session = useRef<CollabSession | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (room: string, seed: boolean) => {
    if (RELAY_URL === null || session.current !== null) return;
    setBusy(true);
    try {
      const { joinRoom } = await import('../collab/session');
      session.current = await joinRoom(editor, { url: RELAY_URL, room, seed });
    } catch (cause) {
      editor.reportError(
        new Error("Couldn't start drawing together. Reload and try again.", { cause }),
      );
    } finally {
      setBusy(false);
    }
  };

  // A room link opens the room. Once per page, StrictMode's second run included.
  const joinedFromLink = useRef(false);
  useEffect(() => {
    const room = roomInLink();
    if (room === null || joinedFromLink.current) return;
    joinedFromLink.current = true;
    void join(room, false);
    // Runs once: `join` only reads refs and the stable editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      notify('Link copied. Anyone with it can draw here with you.', 'info');
    } catch {
      notify("Couldn't copy the link. Select it in the panel and copy it yourself.");
    }
  };

  const status = collab === null ? null : STATUS[collab.status];
  return (
    <div className={styles.area}>
      {status !== null && <StatusBadge tone={status.tone} label={status.label} />}
      <Popover
        label="Draw together"
        align="end"
        className={styles.panel}
        trigger={<IconTrigger label="Draw together" Icon={UsersRound} />}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
      >
        <h2 className={styles.title}>Draw together</h2>
        {RELAY_URL === null ? (
          <p className={styles.text}>Drawing together isn&apos;t set up on this site yet.</p>
        ) : collab === null ? (
          <>
            <p className={styles.text}>
              Start a room from this drawing and share the link. Your own drawing stays on this
              device; leaving the room brings it back.
            </p>
            <Button
              variant="primary"
              icon={Link}
              disabled={busy}
              onClick={() => {
                const room = newRoomName();
                const link = setRoomInLink(room);
                void join(room, true).then(() => copyLink(link));
              }}
            >
              Start a room and copy link
            </Button>
          </>
        ) : (
          <>
            <p className={styles.text}>Anyone with this link can draw here with you:</p>
            <p className={styles.link}>{location.href}</p>
            <PeopleList />
            <div className={styles.actions}>
              <Button icon={Link} onClick={() => void copyLink(location.href)}>
                Copy link
              </Button>
              <Button
                variant="ghost"
                icon={LogOut}
                onClick={() => {
                  const leaving = session.current;
                  session.current = null;
                  setRoomInLink(null);
                  void leaving?.leave();
                }}
              >
                Leave room
              </Button>
            </div>
          </>
        )}
      </Popover>
    </div>
  );
}
