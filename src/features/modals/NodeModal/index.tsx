import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import Editor from "@monaco-editor/react";
import { toast } from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import useConfig from "../../../store/useConfig";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Update JSON at a specific path with new value
const updateJsonAtPath = (json: string, path: NodeData["path"], newValue: any): string => {
  try {
    const obj = JSON.parse(json);
    if (!path || path.length === 0) {
      // Root level update
      return JSON.stringify(newValue, null, 2);
    }

    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = newValue;
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    throw new Error("Failed to update JSON");
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);
  const darkmodeEnabled = useConfig(state => (state.darkmodeEnabled ? "vs-dark" : "light"));
  
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  const handleEditClick = React.useCallback(() => {
    setEditValue(normalizeNodeData(nodeData?.text ?? []));
    setIsEditMode(true);
  }, [nodeData]);

  const handleSave = React.useCallback(() => {
    try {
      // Validate JSON syntax
      const parsedValue = JSON.parse(editValue);
      
      // Update the JSON at the node's path
      const updatedJson = updateJsonAtPath(getJson(), nodeData?.path, parsedValue);
      
      // Update both the JSON store and the file contents
      setJson(updatedJson);
      setContents({ contents: updatedJson, hasChanges: true });
      
      toast.success("Node updated successfully!");
      setIsEditMode(false);
      setEditValue("");
      // Close the modal to immediately show the updated visualization
      onClose();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON syntax");
      } else {
        toast.error("Failed to update node");
      }
    }
  }, [editValue, nodeData, getJson, setJson, setContents, onClose]);

  const handleCancel = React.useCallback(() => {
    setIsEditMode(false);
    setEditValue("");
  }, []);

  if (isEditMode) {
    return (
      <Modal 
        size="lg" 
        opened={opened} 
        onClose={onClose} 
        centered 
        withCloseButton={false}
        title="Edit Node Values"
      >
        <Stack pb="sm" gap="sm">
          <Stack gap="xs">
            <Text fz="sm" c="dimmed">
              Edit the JSON content for this node. Changes will be reflected in the main editor.
            </Text>
            <Editor
              height="300px"
              defaultLanguage="json"
              theme={darkmodeEnabled}
              value={editValue}
              onChange={e => setEditValue(e || "")}
              options={{
                minimap: { enabled: false },
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
              }}
            />
          </Stack>
          <Group justify="flex-end" pt="sm">
            <Button variant="default" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} color="blue">
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            <CodeHighlight
              code={normalizeNodeData(nodeData?.text ?? [])}
              miw={350}
              maw={600}
              language="json"
              withCopyButton
            />
          </ScrollArea.Autosize>
        </Stack>
        <Group justify="flex-end">
          <Button size="xs" variant="light" onClick={handleEditClick}>
            Edit Node Values
          </Button>
        </Group>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
