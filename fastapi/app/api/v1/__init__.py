from .assets import router as assets_router
from .chat import router as chat_router
from .personas import router as personas_router
from .tools import router as tools_router
from .categories import router as categories_router
from .tags import router as tags_router
from .prompt_templates import router as prompt_templates_router
from .chat_models import router as chat_models_router
from .workflows import router as workflows_router
from .knowledge_bases import router as knowledge_bases_router
from .users import router as users_router
from .dependencies import get_current_user 

# Make sure this router is included in your routers list
routers = [
    prompt_templates_router,
    chat_router,
    assets_router,
    personas_router,
    tools_router,
    categories_router,
    tags_router,
    chat_models_router,
    workflows_router,
    knowledge_bases_router,
    users_router,
    # ... other routers ...
] 