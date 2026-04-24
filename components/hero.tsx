export function Hero() {
  return (
    <div className="flex flex-col gap-16 items-center">
      
      <h1 className="sr-only">TitleCard</h1>
      <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center">
        Welcome to{" "}
        <a
          className="font-bold hover:underline"
          rel="noreferrer"
        >
          RoomMeet
        </a>{" "}
      </p>
      <p>
        Meet your future roommate before opening the door
      </p>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}
