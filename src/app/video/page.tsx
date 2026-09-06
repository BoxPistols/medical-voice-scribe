import type { Metadata } from "next";
import { VideoPlayer } from "./VideoPlayer";

export const metadata: Metadata = {
  title: "製品紹介動画 | Vital Flow",
  description: "Vital Flowの製品紹介動画プレビュー",
};

export default function VideoPage() {
  return <VideoPlayer />;
}
