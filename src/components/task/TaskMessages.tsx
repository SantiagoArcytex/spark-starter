import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface TaskMessagesProps {
  taskId: string;
}

export default function TaskMessages({ taskId }: TaskMessagesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (data) {
      const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", senderIds);
      const nameMap = Object.fromEntries(
        (profiles || []).map((p) => [p.user_id, p.full_name || "Unknown"])
      );
      setMessages(
        data.map((m: any) => ({ ...m, sender_name: nameMap[m.sender_id] || "Unknown" }))
      );
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [taskId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`task-messages-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `task_id=eq.${taskId}` },
        () => fetchMessages()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;
    setSendingMsg(true);
    const { error } = await supabase.from("messages").insert({
      task_id: taskId,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
    }
    setSendingMsg(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Start the conversation.
            </p>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <span className="mb-0.5 text-xs text-muted-foreground">{msg.sender_name}</span>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          />
          <Button onClick={sendMessage} disabled={sendingMsg || !newMessage.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
