import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Menu, ChevronLeft, ChevronRight, MessageSquare, ScrollText, Map, Video, Pencil, Ruler } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';
import Button from '@/components/ui/Button';

export default function VttSidebar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSidebarOpen, toggleSidebar } = useVttStore();

  return (
    <>
      {/* Кнопка відкриття (якщо панель закрита) - або можна зробити "язичок" */}
      <div 
        className={`absolute top-0 left-0 h-full z-40 transition-transform duration-300 ease-in-out flex ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-64'
        }`}
      >
        {/* Сама панель */}
        <div className="w-64 h-full bg-brand-dark/95 backdrop-blur-md border-r border-brand-light/20 flex flex-col shadow-2xl">
          <div className="p-4 border-b border-brand-light/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-accent font-bold">
              <Menu size={20} />
              <span>Меню</span>
            </div>
            {/* Кнопка закриття всередині панелі */}
            <button 
              onClick={toggleSidebar}
              className="text-brand-light/50 hover:text-white transition-colors lg:hidden"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-2">
            <Button
              onClick={() => {
                useVttStore.getState().toggleCall();
                toggleSidebar();
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <Video size={18} className="text-blue-400" />
              <span>Голосовий зв'язок</span>
            </Button>

            <Button
              onClick={() => {
                useVttStore.getState().toggleChat();
                toggleSidebar(); // Закриваємо сайдбар після кліку для зручності
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <MessageSquare size={18} className="text-brand-accent" />
              <span>Ігровий Чат</span>
            </Button>

            <Button
              onClick={() => {
                useVttStore.getState().toggleDrawingTools();
                toggleSidebar();
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <Pencil size={18} className="text-pink-400" />
              <span>Малювання</span>
            </Button>

            <Button
              onClick={() => {
                useVttStore.getState().toggleRulerTools();
                toggleSidebar();
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <Ruler size={18} className="text-cyan-400" />
              <span>Лінійка</span>
            </Button>

            <Button
              onClick={() => {
                useVttStore.getState().toggleDiceLog();
                toggleSidebar();
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <ScrollText size={18} className="text-amber-400" />
              <span>Журнал кидків</span>
            </Button>

            <Button
              onClick={() => {
                useVttStore.getState().toggleSceneManager();
                toggleSidebar();
              }}
              variant="outline"
              className="w-full !border-brand-light/20 !text-brand-light hover:!bg-brand-medium/30 flex items-center justify-start gap-3 !px-4"
            >
              <Map size={18} className="text-emerald-400" />
              <span>Менеджер сцени</span>
            </Button>

            {/* Тут в майбутньому будуть інші компоненти */}
            <div className="text-brand-light/40 text-sm italic text-center mt-10 border-t border-brand-light/10 pt-4">
              Більше інструментів згодом...
            </div>
          </div>

          <div className="p-4 border-t border-brand-light/10">
            <Button
              onClick={() => navigate(`/session/${id}`)}
              variant="outline"
              className="w-full !border-brand-light/30 !text-brand-light hover:!bg-brand-light/10 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Повернутися до сесії
            </Button>
          </div>
        </div>

        {/* Язичок / Кнопка відкриття, що приліплена до правого краю панелі */}
        <button
          onClick={toggleSidebar}
          className="absolute top-1/2 -right-8 -translate-y-1/2 w-8 h-16 bg-brand-dark/90 backdrop-blur-md border border-l-0 border-brand-light/20 rounded-r-xl flex items-center justify-center text-brand-light hover:text-white hover:bg-brand-medium/50 transition-colors shadow-lg cursor-pointer"
          title={isSidebarOpen ? "Сховати меню" : "Відкрити меню"}
        >
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    </>
  );
}
