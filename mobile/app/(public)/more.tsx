import { useEffect } from "react";
import { router } from "expo-router";
import Spinner from "../../src/components/ui/Spinner";

export default function MorePlaceholder() {
  useEffect(() => {
    router.replace("/(public)/");
  }, []);
  return <Spinner message="Loading..." />;
}
