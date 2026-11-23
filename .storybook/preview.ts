import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "paper",
      values: [
        { name: "paper", value: "#f6f6f2" },
        { name: "dark", value: "#1b1b22" },
      ],
    },
  },
};

export default preview;
